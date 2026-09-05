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
    datalayer decks list           # what the store holds
    datalayer decks show <id>
    datalayer decks delete <id>
"""

from __future__ import annotations

import json
import os
import webbrowser
from pathlib import Path
from typing import Optional

import typer
from reactor import PluginManifest

from .storage import DeckNotFound, DeckStore

app = typer.Typer(
    name="decks",
    help="Presentations described as data: serve them, list them, look at one.",
    no_args_is_help=True,
)

DEFAULT_PORT = 8797


def _store(decks_dir: Optional[Path]) -> DeckStore:
    return DeckStore(decks_dir)


@app.command()
def serve(
    port: int = typer.Option(DEFAULT_PORT, help="Port to listen on."),
    host: str = typer.Option("127.0.0.1", help="Interface to bind."),
    decks_dir: Optional[Path] = typer.Option(
        None, "--decks-dir", help="Where decks are stored (else $DATALAYER_DECKS_DIR, else ~/.datalayer/decks)."
    ),
    ui: bool = typer.Option(True, "--ui/--no-ui", help="Serve the built interface at /."),
    open_browser: bool = typer.Option(True, "--open/--no-open", help="Open the interface in a browser."),
    reload: bool = typer.Option(False, "--reload", help="Reload on code changes (development)."),
) -> None:
    """Serve the decks API and its interface from one origin."""
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

    application = create_app(with_ui=ui, decks_dir=decks_dir)
    url = f"http://{host}:{port}/"
    typer.secho(f"Datalayer Decks on {url}", fg=typer.colors.GREEN, err=True)
    if open_browser and ui:
        # Best effort, and only once the server is about to listen. A headless
        # machine simply has no browser to open.
        try:
            webbrowser.open(url)
        except Exception:  # noqa: BLE001
            pass
    run_reactor_host(application, host=host, port=port, reload=reload)


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
    """Delete a deck. Irreversible."""
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
    version="1.0.0",
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
