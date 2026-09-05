# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""Decks as a Reactor extension: the API as a plugin, the UI as a frontend.

Installing ``datalayer_decks`` beside any Reactor host publishes this. The
Python plugin provides the ``/decks`` routes; the frontend half is the built
``@datalayer/decks/plugin`` as a Module Federation container, when the app
build has produced one, so a shell that bootstraps its extensions gets the
Decks view, list and commands without importing the package.
"""

from __future__ import annotations

from pathlib import Path

from reactor import (
    ExtensionManifest,
    FrontendExtension,
    FrontendPlugin,
    PluginManifest,
    ReactorExtension,
    find_extension_frontend,
)

from .api import build_decks_router
from .storage import DeckStore

DECKS_PLUGIN_MANIFEST = PluginManifest(
    name="decks",
    version="1.0.0",
    display_name="Decks",
    description="Stores and serves decks as JSON specifications.",
)


class DecksPlugin:
    """The server side: a router over a directory of decks."""

    def __init__(self, store: DeckStore | None = None) -> None:
        self.store = store or DeckStore()

    def provide_routes(self) -> list[dict]:
        return [{"path": "/decks", "method": "GET", "summary": "List decks."}]

    def router(self):  # noqa: ANN201 — FastAPI's APIRouter, kept out of the import chain
        return build_decks_router(self.store)


#: The frontend, when the app has been built as a container into ``share/``.
_FRONTEND: Path | None = find_extension_frontend(__file__, "decks")


def extension(store: DeckStore | None = None) -> ReactorExtension:
    frontend = None
    if _FRONTEND is not None and (_FRONTEND / "remoteEntry.js").is_file():
        frontend = FrontendExtension(
            directory=_FRONTEND,
            entry="remoteEntry.js",
            api_version="v1",
            kind="federated",
            remote_name="datalayer_decks",
            module="./plugin",
            plugins=[
                FrontendPlugin(
                    name="@datalayer/decks",
                    version="1.0.0",
                    display_name="Decks",
                    description="List, open and create decks.",
                    octicon="project",
                    required_backend_plugins=["decks"],
                ),
            ],
        )
    return ReactorExtension(
        manifest=ExtensionManifest(
            name="decks",
            version="1.0.0",
            display_name="Decks",
            description="Presentations described as data.",
            octicon="project",
            emoji="📊",
        ),
        plugins=[(DECKS_PLUGIN_MANIFEST, DecksPlugin(store))],
        frontend=frontend,
    )
