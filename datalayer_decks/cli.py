# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""``datalayer decks``: the decks command group, and the ``datalayer-decks`` script.

Two doors to the same commands. Installed beside the Datalayer CLI, this
distribution advertises a plugin under the ``datalayer.cli`` entry-point group
and the ``datalayer`` command gains a ``decks`` group — nobody has to know
which package a feature ships in. On its own, ``datalayer-decks`` runs the
same group.

    datalayer decks serve          # the API and the interface, one origin
    datalayer decks serve talk.yaml  # load and open one YAML deck
    datalayer decks pdf talk.yaml    # the deck's print view saved as talk.pdf
    datalayer decks collage talk.yaml  # every slide on one page: talk-collage.png and .pdf
    datalayer decks list           # what the store holds
    datalayer decks show <id>
    datalayer decks delete <id>
"""

from __future__ import annotations

import io
import json
import os
import re
import socket
import tempfile
import threading
import time
import webbrowser
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator, Optional
from urllib.parse import urlencode

import typer
import yaml
from reactor import PluginManifest

from .__version__ import __version__
from .storage import DeckNotFound, DeckStore

app = typer.Typer(
    name="decks",
    help="Serve, list and look at presentations described as data.",
    no_args_is_help=True,
)

DEFAULT_PORT = 8797
_SLUG_CHARACTER = re.compile(r"[^a-z0-9._-]+")


def _store(decks_dir: Optional[Path]) -> DeckStore:
    return DeckStore(decks_dir)


def _load_deck(path: Path) -> dict[str, Any]:
    """Read a YAML (or JSON, which is YAML) deck and reject obvious mistakes."""
    try:
        value = yaml.safe_load(path.read_text(encoding="utf-8"))
    except (OSError, yaml.YAMLError) as error:
        raise ValueError(f"Could not read {path}: {error}") from error
    if not isinstance(value, dict):
        raise ValueError("A deck file must contain a mapping at its top level.")
    metadata = value.get("deck")
    if not isinstance(metadata, dict) or not metadata.get("title"):
        raise ValueError("A deck file needs `deck.title`.")
    if not isinstance(value.get("slides"), list) or not value["slides"]:
        raise ValueError("A deck file needs a non-empty `slides` list.")
    return value


def _plugin_names(values: Optional[list[str]]) -> list[str]:
    """``--reactor-plugins a,b --reactor-plugins c`` → ``["a", "b", "c"]``, once each."""
    names: list[str] = []
    for value in values or []:
        for name in value.split(","):
            name = name.strip()
            if name and name not in names:
                names.append(name)
    return names


def _file_slug(path: Path) -> str:
    """Turn a filename into the same conservative address the store accepts."""
    slug = _SLUG_CHARACTER.sub("-", path.stem.lower()).strip("-._")
    return (slug or "deck")[:64]


@app.command()
def serve(
    deck: Optional[Path] = typer.Argument(
        None,
        exists=True,
        dir_okay=False,
        readable=True,
        resolve_path=True,
        help="A YAML deck to serve directly.",
    ),
    port: int = typer.Option(DEFAULT_PORT, help="Port to listen on."),
    host: str = typer.Option("127.0.0.1", help="Interface to bind."),
    decks_dir: Optional[Path] = typer.Option(
        None, "--decks-dir", help="Where decks are stored (else $DATALAYER_DECKS_DIR, else ~/.datalayer/decks)."
    ),
    ui: bool = typer.Option(True, "--ui/--no-ui", help="Serve the built interface at /."),
    open_browser: bool = typer.Option(True, "--open/--no-open", help="Open the interface in a browser."),
    reload: bool = typer.Option(False, "--reload", help="Reload on code changes (development)."),
    reactor_plugins: Optional[list[str]] = typer.Option(
        None,
        "--reactor-plugins",
        help=(
            "Optional interface plugins to activate, by name; repeat the option or "
            "separate names with commas. Known: ai-agents (the Decks agent "
            "beside the decks, on a temporary key)."
        ),
    ),
) -> None:
    """Serve the decks API and interface, optionally opening one YAML deck."""
    from reactor.host import run_reactor_host

    from .host import create_app, ui_directory

    if ui and ui_directory() is None:
        typer.secho(
            "The interface has not been built: only the API will be served.\n"
            "Build it with `npm run build --prefix app` (or `make build-app`) in the "
            "datalayer_decks checkout, or install the wheel, which carries it.",
            fg=typer.colors.YELLOW,
            err=True,
        )
        ui = False

    specification: dict[str, Any] | None = None
    if deck is not None:
        try:
            specification = _load_deck(deck)
        except ValueError as error:
            raise typer.BadParameter(str(error), param_hint="DECK") from error

    # A directly served file is copied to an ephemeral store unless the caller
    # explicitly chose a persistent one. This keeps `serve talk.yaml` from
    # quietly modifying ~/.datalayer/decks.
    temporary: tempfile.TemporaryDirectory[str] | None = None
    selected_dir = decks_dir
    if specification is not None and selected_dir is None:
        temporary = tempfile.TemporaryDirectory(prefix="datalayer-decks-")
        selected_dir = Path(temporary.name)

    old_directory = os.environ.get("DATALAYER_DECKS_DIR")
    try:
        if specification is not None:
            assert selected_dir is not None
            slug = _file_slug(deck)
            DeckStore(selected_dir).put("local", slug, specification)
        plugins = _plugin_names(reactor_plugins)
        application = create_app(with_ui=ui, decks_dir=selected_dir, reactor_plugins=plugins)
        path = f"decks/local/{slug}" if specification is not None else ""
        url = f"http://{host}:{port}/{path}"
        typer.secho(f"Datalayer Decks on {url}", fg=typer.colors.GREEN, err=True)
        if plugins:
            typer.secho(f"Reactor plugins: {', '.join(plugins)}", fg=typer.colors.GREEN, err=True)
        if open_browser and ui:
            # Best effort, and only once the server is about to listen. A headless
            # machine simply has no browser to open.
            try:
                webbrowser.open(url)
            except Exception:  # noqa: BLE001
                pass
        run_reactor_host(application, host=host, port=port, reload=reload)
    finally:
        if old_directory is None:
            os.environ.pop("DATALAYER_DECKS_DIR", None)
        else:
            os.environ["DATALAYER_DECKS_DIR"] = old_directory
        if temporary is not None:
            temporary.cleanup()


def _print_query(specification: dict[str, Any], theme: Optional[str], mode: Optional[str]) -> str:
    """The print view's query: the theme and colour mode asked, else the deck's own."""
    metadata = specification.get("deck") or {}
    chosen = {
        "theme": theme or metadata.get("theme"),
        "mode": mode or metadata.get("colorMode") or "light",
    }
    return urlencode({key: value for key, value in chosen.items() if value})


def _pdf_pages(path: Path) -> int:
    """The number of pages of a PDF, counted from its page objects."""
    return len(re.findall(rb"/Type\s*/Page[^s]", path.read_bytes()))


@contextmanager
def _print_view(
    deck: Path, theme: Optional[str], mode: Optional[str], wait: float, scale: float = 1.0
) -> Iterator[Any]:
    """A headless Chromium page on the deck's print view, served on a free local port."""
    import uvicorn

    from .host import create_app, ui_directory

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise typer.BadParameter(
            "Playwright is needed: pip install 'datalayer_decks[pdf]' && playwright install chromium"
        ) from error
    if ui_directory() is None:
        raise typer.BadParameter(
            "The interface has not been built: build it with `make build-app` in the "
            "datalayer_decks checkout, or install the wheel, which carries it."
        )
    try:
        specification = _load_deck(deck)
    except ValueError as error:
        raise typer.BadParameter(str(error), param_hint="DECK") from error

    slug = _file_slug(deck)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    old_directory = os.environ.get("DATALAYER_DECKS_DIR")
    with tempfile.TemporaryDirectory(prefix="datalayer-decks-print-") as directory:
        try:
            DeckStore(Path(directory)).put("local", slug, specification)
            application = create_app(with_ui=True, decks_dir=Path(directory))
            server = uvicorn.Server(uvicorn.Config(application, host="127.0.0.1", port=port, log_level="warning"))
            thread = threading.Thread(target=server.run, daemon=True)
            thread.start()
            deadline = time.time() + 30
            while not server.started:
                if time.time() > deadline or not thread.is_alive():
                    raise typer.Exit(code=1)
                time.sleep(0.1)
            url = f"http://127.0.0.1:{port}/decks/local/{slug}/print?{_print_query(specification, theme, mode)}"
            try:
                with sync_playwright() as playwright:
                    browser = playwright.chromium.launch()
                    page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=scale)
                    # The print view opens the browser's print dialog once ready: not here.
                    page.add_init_script("window.print = () => {}")
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_selector(".reveal .slides section", timeout=60_000)
                    page.wait_for_timeout(wait * 1000)
                    yield page
                    browser.close()
            finally:
                server.should_exit = True
                thread.join(timeout=10)
        finally:
            if old_directory is None:
                os.environ.pop("DATALAYER_DECKS_DIR", None)
            else:
                os.environ["DATALAYER_DECKS_DIR"] = old_directory


_DECK_ARGUMENT = typer.Argument(..., exists=True, dir_okay=False, readable=True, resolve_path=True, help="The YAML deck.")
_THEME_OPTION = typer.Option(None, help="Theme variant (else the deck's `theme`), e.g. metal.")
_MODE_OPTION = typer.Option(None, help="Colour mode: light or dark (else the deck's `colorMode`, else light).")
_WAIT_OPTION = typer.Option(4.0, help="Seconds to let diagrams and fonts draw before capturing.")


@app.command()
def pdf(
    deck: Path = _DECK_ARGUMENT,
    output: Optional[Path] = typer.Option(
        None, "--output", "-o", help="The PDF to write (else the deck's name with .pdf, beside it)."
    ),
    theme: Optional[str] = _THEME_OPTION,
    mode: Optional[str] = _MODE_OPTION,
    max_pages: Optional[int] = typer.Option(
        None, "--max-pages", help="Fail when the PDF has more pages than this (a slide that overflows adds one)."
    ),
    wait: float = _WAIT_OPTION,
) -> None:
    """Export a YAML deck to PDF: its print view, one slide a page, in headless Chromium.

    Needs the pdf extra: pip install 'datalayer_decks[pdf]' && playwright install chromium.
    """
    target = (output or deck.with_suffix(".pdf")).resolve()
    with _print_view(deck, theme, mode, wait) as page:
        page.pdf(path=str(target), prefer_css_page_size=True, print_background=True)
    pages = _pdf_pages(target)
    typer.echo(f"{target}: {pages} pages")
    if max_pages is not None and pages > max_pages:
        typer.secho(f"Over the limit of {max_pages} pages.", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)


def _collage_columns(count: int, columns: Optional[int]) -> int:
    """The grid's width: the columns asked, else the smallest square that holds every slide."""
    if columns is not None:
        if columns < 1:
            raise typer.BadParameter("--columns must be at least 1.")
        return columns
    width = 1
    while width * width < count:
        width += 1
    return width


@app.command()
def collage(
    deck: Path = _DECK_ARGUMENT,
    png: Optional[Path] = typer.Option(None, "--png", help="The PNG to write (else <deck>-collage.png, beside it)."),
    pdf_path: Optional[Path] = typer.Option(
        None, "--pdf", help="The one-page PDF to write (else <deck>-collage.pdf, beside it)."
    ),
    columns: Optional[int] = typer.Option(None, help="Slides per row (else the smallest square grid)."),
    gap: int = typer.Option(32, help="Pixels between slides and around them."),
    scale: float = typer.Option(1.0, help="Device pixel ratio of each slide's capture (2 for a sharper collage)."),
    theme: Optional[str] = _THEME_OPTION,
    mode: Optional[str] = _MODE_OPTION,
    wait: float = _WAIT_OPTION,
) -> None:
    """Every slide of a YAML deck on one page: a PNG and a one-page PDF, in a grid.

    Needs the pdf extra: pip install 'datalayer_decks[pdf]' && playwright install chromium.
    """
    try:
        from PIL import Image
    except ImportError as error:
        raise typer.BadParameter("Pillow is needed: pip install 'datalayer_decks[pdf]'") from error

    stem = deck.with_suffix("")
    png_target = (png or Path(f"{stem}-collage.png")).resolve()
    pdf_target = (pdf_path or Path(f"{stem}-collage.pdf")).resolve()
    with _print_view(deck, theme, mode, wait, scale) as page:
        slides = page.query_selector_all(".pdf-page") or page.query_selector_all(".reveal .slides section")
        if not slides:
            raise typer.BadParameter("The print view drew no slide.", param_hint="DECK")
        shots = [Image.open(io.BytesIO(slide.screenshot())).convert("RGB") for slide in slides]
    width = max(shot.width for shot in shots)
    height = max(shot.height for shot in shots)
    across = _collage_columns(len(shots), columns)
    down = -(-len(shots) // across)
    sheet = Image.new("RGB", (across * width + (across + 1) * gap, down * height + (down + 1) * gap), "white")
    for index, shot in enumerate(shots):
        x = gap + (index % across) * (width + gap)
        y = gap + (index // across) * (height + gap)
        sheet.paste(shot, (x, y))
    sheet.save(png_target)
    sheet.save(pdf_target, "PDF", resolution=96.0)
    typer.echo(f"{png_target}: {len(shots)} slides, {across} × {down}")
    typer.echo(f"{pdf_target}: 1 page")


@app.command("list")
def list_decks(
    decks_dir: Optional[Path] = typer.Option(None, "--decks-dir"),
    as_json: bool = typer.Option(False, "--json", help="Machine-readable output."),
) -> None:
    """The decks in the store, one per line."""
    records = _store(decks_dir).list()
    if as_json:
        typer.echo(json.dumps([r.to_dict() for r in records], indent=2))
        return
    if not records:
        typer.echo("No decks. Make one with `datalayer decks serve`, or an agent.")
        return
    for record in records:
        title = record.spec.get("deck", {}).get("title", "")
        slides = len(record.spec.get("slides", []))
        typer.echo(f"{record.id:40s} {slides:3d} slides  {title}")


@app.command()
def show(
    deck_id: str = typer.Argument(..., help="The deck id, `collection/slug` or `slug`."),
    decks_dir: Optional[Path] = typer.Option(None, "--decks-dir"),
) -> None:
    """One deck's specification, as JSON."""
    try:
        record = _store(decks_dir).get(deck_id)
    except DeckNotFound:
        typer.secho(f"There is no deck {deck_id}.", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from None
    typer.echo(json.dumps(record.to_dict(), indent=2))


@app.command()
def delete(
    deck_id: str = typer.Argument(..., help="The deck id, `collection/slug` or `slug`."),
    decks_dir: Optional[Path] = typer.Option(None, "--decks-dir"),
    yes: bool = typer.Option(False, "--yes", "-y", help="Do not ask."),
) -> None:
    """Delete a deck.

    Irreversible.
    """
    store = _store(decks_dir)
    try:
        store.get(deck_id)
    except DeckNotFound:
        typer.secho(f"There is no deck {deck_id}.", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1) from None
    if not yes and not typer.confirm(f"Delete {deck_id}?"):
        raise typer.Exit(code=1)
    store.delete(deck_id)
    typer.echo(f"Deleted {deck_id}.")


# ── The Datalayer CLI plugin ──────────────────────────────────────────────

#: The identity of the extension, for the reactor that hosts the CLI.
manifest = PluginManifest(
    name="decks-cli",
    version=__version__,
    description="The `decks` command group: serve, list, show, delete.",
    author="Datalayer",
    tags=["cli", "decks"],
)


class DecksCliExtension:
    """The plugin: registers the ``decks`` group into the host CLI."""

    def provide_cli(self, cli: "typer.Typer") -> None:
        cli.add_typer(app, name="decks")


def plugin() -> tuple[PluginManifest, DecksCliExtension]:
    """What the ``datalayer.cli`` entry point resolves to."""
    return manifest, DecksCliExtension()


def main() -> None:
    """The ``datalayer-decks`` console script: the same group, on its own."""
    app()
