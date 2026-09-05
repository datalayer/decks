# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The decks API: list, read, write and delete decks as JSON specs.

Mounted under ``/decks`` by the host, and by any Reactor host that installed
this distribution, since the extension's Python plugin provides the same
router. The frontend plugin's ``backendUrl`` points here.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from .storage import DeckNotFound, DeckStore, InvalidDeckId


class DeckPayload(BaseModel):
    """What a client sends to create or replace a deck."""

    collection: str = Field(default="", description="The family, or empty for a standalone deck.")
    slug: str = Field(min_length=1, description="The address segment: lowercase, digits, - _ .")
    spec: dict[str, Any] = Field(description="The deck specification, as the frontend renders it.")


def build_decks_router(store: DeckStore) -> APIRouter:
    router = APIRouter(prefix="/decks", tags=["decks"])

    @router.get("")
    def list_decks() -> list[dict[str, Any]]:
        return [record.to_dict() for record in store.list()]

    @router.get("/{identifier:path}")
    def get_deck(identifier: str) -> dict[str, Any]:
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
        try:
            store.get(identifier)
            return store.put(payload.collection, payload.slug, payload.spec).to_dict()
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
