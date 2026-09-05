# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The decks API over a directory: create, list, read, replace, delete, refuse."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from datalayer_decks import create_app
from datalayer_decks.storage import DeckStore

SPEC = {"deck": {"title": "Hello", "template": "datalayer"}, "slides": [{"type": "title", "title": "Hello"}]}


def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(with_ui=False, decks_dir=tmp_path))


def test_a_deck_round_trips(tmp_path: Path) -> None:
    api = client(tmp_path)
    created = api.post("/decks", json={"collection": "talks", "slug": "hello", "spec": SPEC})
    assert created.status_code == 201
    assert created.json()["id"] == "talks/hello"
    assert (tmp_path / "talks" / "hello.json").is_file()

    assert [d["id"] for d in api.get("/decks").json()] == ["talks/hello"]
    assert api.get("/decks/talks/hello").json()["spec"] == SPEC

    changed = {**SPEC, "deck": {**SPEC["deck"], "title": "Hello again"}}
    assert api.put("/decks/talks/hello", json={"collection": "talks", "slug": "hello", "spec": changed}).status_code == 200
    assert api.get("/decks/talks/hello").json()["spec"]["deck"]["title"] == "Hello again"

    assert api.delete("/decks/talks/hello").status_code == 204
    assert api.get("/decks/talks/hello").status_code == 404


def test_a_standalone_deck_has_a_flat_address(tmp_path: Path) -> None:
    api = client(tmp_path)
    api.post("/decks", json={"slug": "investors", "spec": SPEC})
    assert (tmp_path / "investors.json").is_file()
    assert api.get("/decks/investors").json()["collection"] == ""


def test_ids_cannot_leave_the_directory(tmp_path: Path) -> None:
    api = client(tmp_path)
    assert api.get("/decks/../etc/passwd").status_code in (400, 404)
    assert api.post("/decks", json={"slug": "../escape", "spec": SPEC}).status_code == 400
    assert api.post("/decks", json={"collection": "a/b", "slug": "x", "spec": SPEC}).status_code == 400
    assert not (tmp_path.parent / "escape.json").exists()


def test_the_reactor_lists_the_decks_plugin(tmp_path: Path) -> None:
    api = client(tmp_path)
    names = [p["name"] for p in api.get("/plugins").json()]
    assert "decks" in names


def test_a_put_to_another_address_moves_the_deck(tmp_path: Path) -> None:
    client = globals()['client'](tmp_path)
    client.post("/decks", json={"collection": "talks", "slug": "old", "spec": {"deck": {"title": "T"}, "slides": []}})
    moved = client.put(
        "/decks/talks/old",
        json={"collection": "archive", "slug": "new", "spec": {"deck": {"title": "T, renamed"}, "slides": []}},
    )
    assert moved.status_code == 200 and moved.json()["id"] == "archive/new"
    assert not (tmp_path / "talks" / "old.json").exists()
    assert (tmp_path / "archive" / "new.json").is_file()
    assert client.get("/decks/talks/old").status_code == 404
    assert [d["id"] for d in client.get("/decks").json()] == ["archive/new"]


def test_a_browser_gets_the_interface_at_a_deck_address(tmp_path: Path) -> None:
    from fastapi import FastAPI

    from datalayer_decks.api import build_decks_router

    index = tmp_path / "ui" / "index.html"
    index.parent.mkdir()
    index.write_text("<!doctype html><title>Decks</title>")
    store = DeckStore(tmp_path / "store")
    store.put("talks", "q2", {"deck": {"title": "Q2"}, "slides": []})
    app = FastAPI()
    app.include_router(build_decks_router(store, index))
    client = TestClient(app)
    html = {"accept": "text/html,application/xhtml+xml,*/*;q=0.8"}
    # The print view, and a deep link, are the interface's business.
    assert client.get("/decks/talks/q2/print?theme=matrix&mode=dark", headers=html).text.startswith("<!doctype html>")
    assert client.get("/decks/talks/q2", headers=html).headers["content-type"].startswith("text/html")
    # A client fetching JSON still gets the deck, and a missing one a 404.
    assert client.get("/decks/talks/q2", headers={"accept": "application/json"}).json()["id"] == "talks/q2"
    assert client.get("/decks/talks/q2").json()["id"] == "talks/q2"
    assert client.get("/decks/talks/nope").status_code == 404
    # Without an interface the API answers as before, whoever asks.
    bare = TestClient(FastAPI()); bare.app.include_router(build_decks_router(store))
    assert bare.get("/decks/talks/q2", headers=html).json()["id"] == "talks/q2"
