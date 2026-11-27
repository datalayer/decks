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
    datalayer decks list           # what the store holds
    datalayer decks show <id>
    datalayer decks delete <id>
"""

from __future__ import annotations

import json
import os
import re
import socket
import tempfile
import threading
import time
import webbrowser
from pathlib import Path
from typing import Any, Optional
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


@app.command()
def pdf(
    deck: Path = typer.Argument(
        ...,
        exists=True,
        dir_okay=False,
        readable=True,
        resolve_path=True,
        help="The YAML deck to export.",
    ),
    output: Optional[Path] = typer.Option(
        None, "--output", "-o", help="The PDF to write (else the deck's name with .pdf, beside it)."
    ),
    theme: Optional[str] = typer.Option(None, help="Theme variant (else the deck's `theme`), e.g. metal."),
    mode: Optional[str] = typer.Option(None, help="Colour mode: light or dark (else the deck's `colorMode`, else light)."),
    max_pages: Optional[int] = typer.Option(
        None, "--max-pages", help="Fail when the PDF has more pages than this (a slide that overflows adds one)."
    ),
    wait: float = typer.Option(4.0, help="Seconds to let diagrams and fonts draw before printing."),
) -> None:
    """Export a YAML deck to PDF: its print view, one slide a page, in headless Chromium.

    Needs Playwright and its Chromium (`pip install playwright && playwright install chromium`).
    """
    import uvicorn

    from .host import create_app, ui_directory

    try:
        from playwright.sync_api import sync_playwright
    except ImportError as error:
        raise typer.BadParameter(
            "Playwright is needed: pip install playwright && playwright install chromium"
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

    target = (output or deck.with_suffix(".pdf")).resolve()
    slug = _file_slug(deck)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]

    old_directory = os.environ.get("DATALAYER_DECKS_DIR")
    with tempfile.TemporaryDirectory(prefix="datalayer-decks-pdf-") as directory:
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
                    page = browser.new_page(viewport={"width": 1920, "height": 1080})
                    page.goto(url, wait_until="networkidle")
                    page.wait_for_selector(".reveal .slides section", timeout=60_000)
                    page.wait_for_timeout(wait * 1000)
                    page.pdf(path=str(target), prefer_css_page_size=True, print_background=True)
                    browser.close()
            finally:
                server.should_exit = True
                thread.join(timeout=10)
        finally:
            if old_directory is None:
                os.environ.pop("DATALAYER_DECKS_DIR", None)
            else:
                os.environ["DATALAYER_DECKS_DIR"] = old_directory

    pages = _pdf_pages(target)
    typer.echo(f"{target}: {pages} pages")
    if max_pages is not None and pages > max_pages:
        typer.secho(f"Over the limit of {max_pages} pages.", fg=typer.colors.RED, err=True)
        raise typer.Exit(code=1)


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
