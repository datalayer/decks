# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The decks API: list, read, write and delete decks as JSON specs.

Mounted under ``/decks`` by the host, and by any Reactor host that installed
this distribution, since the extension's Python plugin provides the same
router. The frontend plugin's ``backendUrl`` points here.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from .storage import DeckNotFound, DeckStore, InvalidDeckId


class DeckPayload(BaseModel):
    """What a client sends to create or replace a deck."""

    collection: str = Field(default="", description="The family, or empty for a standalone deck.")
    slug: str = Field(min_length=1, description="The address segment: lowercase, digits, - _ .")
    spec: dict[str, Any] = Field(description="The deck specification, as the frontend renders it.")


def _wants_html(request: Request) -> bool:
    """A browser navigating, as opposed to a client fetching JSON.

    A navigation says ``text/html`` first; ``fetch`` says ``*/*`` or
    ``application/json``. Only the first preference is read, so a client that
    lists both in some order it did not think about is still answered JSON.
    """
    accept = request.headers.get("accept", "")
    return accept.split(",", 1)[0].strip().lower().startswith("text/html")


def build_decks_router(store: DeckStore, ui_index: Path | None = None) -> APIRouter:
    """The API, and — given the interface's ``index.html`` — its addresses.

    A deck's address and its print view live under the same ``/decks`` prefix
    as the API, because the address *is* the deck's identity. A route with a
    ``path`` parameter would swallow a browser opening ``/decks/talks/q2/print``
    and answer it "not a deck id", so when the host serves an interface, a
    navigation (``Accept: text/html``) or a ``/print`` address gets that
    interface instead; the interface reads the address and shows the deck.
    """
    router = APIRouter(prefix="/decks", tags=["decks"])

    @router.get("")
    def list_decks() -> list[dict[str, Any]]:
        return [record.to_dict() for record in store.list()]

    @router.get("/{identifier:path}", response_model=None)
    def get_deck(identifier: str, request: Request) -> dict[str, Any] | Response:
        if ui_index is not None and (identifier.endswith("/print") or _wants_html(request)):
            return FileResponse(ui_index)
        try:
            return store.get(identifier).to_dict()
        except InvalidDeckId as error:
            raise HTTPException(status_code=400, detail=f"Not a deck id: {error}") from error
        except DeckNotFound as error:
            raise HTTPException(status_code=404, detail=f"No deck {identifier}") from error

    @router.post("", status_code=201)
    def create_deck(payload: DeckPayload) -> dict[str, Any]:
        try:
            return store.put(payload.collection, payload.slug, payload.spec).to_dict()
        except InvalidDeckId as error:
            raise HTTPException(status_code=400, detail=f"Not a deck id: {error}") from error

    @router.put("/{identifier:path}")
    def replace_deck(identifier: str, payload: DeckPayload) -> dict[str, Any]:
        """Replace a deck — and move it, when the payload names another address.

        A rename is a PUT whose slug or collection differs from the identifier.
        The new record is written first and the old one removed after, so a
        failure on the way leaves the deck where it was rather than nowhere.
        """
        try:
            store.get(identifier)
            record = store.put(payload.collection, payload.slug, payload.spec)
            if record.id != identifier:
                store.delete(identifier)
            return record.to_dict()
        except InvalidDeckId as error:
            raise HTTPException(status_code=400, detail=f"Not a deck id: {error}") from error
        except DeckNotFound as error:
            raise HTTPException(status_code=404, detail=f"No deck {identifier}") from error

    @router.delete("/{identifier:path}", status_code=204)
    def delete_deck(identifier: str) -> None:
        try:
            store.delete(identifier)
        except InvalidDeckId as error:
            raise HTTPException(status_code=400, detail=f"Not a deck id: {error}") from error
        except DeckNotFound as error:
            raise HTTPException(status_code=404, detail=f"No deck {identifier}") from error

    return router
