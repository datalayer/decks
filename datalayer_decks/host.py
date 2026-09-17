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
from typing import Any, Sequence

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


def create_app(
    *,
    with_ui: bool = True,
    decks_dir: str | os.PathLike[str] | None = None,
    reactor_plugins: Sequence[str] = (),
    ai_inference_url: str | None = None,
) -> FastAPI:
    """One platform with the decks plugin, the API under ``/decks``, the UI at ``/``.

    ``reactor_plugins`` names the interface's optional plugins to activate —
    ``ai-agents`` puts the Pitcher beside the decks — and ``ai_inference_url``
    where that agent reaches its model (``$DATALAYER_AI_INFERENCE_URL`` when
    unset; the harness's own default beyond that). Both are answered at
    ``GET /config``, which the interface reads before it builds its reactor:
    the server cannot load a frontend plugin, but it can say which of the
    bundled ones the person asked for.

    This is a product host, not the generic ``reactor`` host: it deliberately
    registers only Decks. Globally discovering every installed extension here
    made unrelated CMS and execution plugins start merely because they shared
    the Python environment.
    """
    # Even if a client calls `/plugins/frontend-extensions?refresh=true`, scan
    # an application-private empty group rather than the global extension
    # group shared by CMS, execution, and other installed products.
    platform = PluginPlatform(extension_group="datalayer.decks.extensions")
    plugin = DecksPlugin(DeckStore(decks_dir))
    platform.register_plugin(DECKS_PLUGIN_MANIFEST, plugin)
    app = create_reactor_host(platform, title="Datalayer Decks", discover=False)
    config = {
        "reactor_plugins": list(reactor_plugins),
        "ai_inference_url": ai_inference_url or os.environ.get("DATALAYER_AI_INFERENCE_URL") or None,
    }
    app.state.decks_config = config

    @app.get("/config", tags=["decks"])
    def host_config() -> dict[str, Any]:
        """What this host was started with, for the interface."""
        return config

    ui = ui_directory() if with_ui else None
    # The router knows the interface's index so a deck's address — and its
    # print view — opens the interface when a browser asks, and JSON otherwise.
    app.include_router(build_decks_router(plugin.store, ui / "index.html" if ui else None))
    # Last: this adds a catch-all, and every route above must win.
    if ui is not None:
        mount_reactor_ui(app, ui)
    return app


def main() -> None:
    """``datalayer-decks`` before it had a command group; ``serve`` with the defaults."""
    serve(
        create_app,
        description="Serve Datalayer Decks: the decks API and its interface, from one origin.",
        default_port=8797,
    )
