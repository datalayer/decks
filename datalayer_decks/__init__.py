# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""Datalayer Decks: presentations described as data, served by one command."""

from .__version__ import __version__
from .api import build_decks_router
from .extension import DecksPlugin, extension
from .host import APP_NAME, create_app, main, ui_directory
from .storage import DeckRecord, DeckStore

__all__ = [
    "APP_NAME",
    "__version__",
    "DeckRecord",
    "DeckStore",
    "DecksPlugin",
    "build_decks_router",
    "create_app",
    "extension",
    "main",
    "ui_directory",
]
