# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The ``datalayer-decks`` command: the decks API and its interface, one origin.

    pip install datalayer_decks
    datalayer-decks

The interface is the Rsbuild app in ``app/``, built into the wheel's
``share/`` — or, in a checkout, whatever ``npm run build`` last wrote to
``app/dist``. Point ``DATALAYER_DECKS_DIR`` at a directory to choose where
decks are stored; ``~/.datalayer/decks`` otherwise.
"""

from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI
from reactor import PluginPlatform, create_reactor_host, find_ui, mount_reactor_ui, serve

from .api import build_decks_router
from .extension import DECKS_PLUGIN_MANIFEST, DecksPlugin
from .storage import DeckStore

#: This application's UI directory, under ``share/datalayer/reactor/apps``.
APP_NAME = "decks"


def ui_directory() -> Path | None:
    """The built interface: from the wheel, else the checkout's ``app/dist``."""
    from_wheel = find_ui(__file__, APP_NAME)
    if from_wheel is not None:
        return from_wheel
    checkout = Path(__file__).resolve().parents[1] / "app" / "dist"
    return checkout if (checkout / "index.html").is_file() else None


def create_app(*, with_ui: bool = True, decks_dir: str | os.PathLike[str] | None = None) -> FastAPI:
    """One platform with the decks plugin, the API under ``/decks``, the UI at ``/``."""
    store = DeckStore(decks_dir or os.environ.get("DATALAYER_DECKS_DIR") or None)
    plugin = DecksPlugin(store)
    platform = PluginPlatform()
    platform.register_plugin(DECKS_PLUGIN_MANIFEST, plugin)
    app = create_reactor_host(platform, title="Datalayer Decks", discover=True)
    app.include_router(build_decks_router(store))
    # Last: this adds a catch-all, and every route above must win.
    if with_ui:
        mount_reactor_ui(app, ui_directory())
    return app


def main() -> None:
    """The ``datalayer-decks`` console script."""
    serve(
        create_app,
        description="Serve Datalayer Decks: the decks API and its interface, from one origin.",
        default_port=8797,
    )
