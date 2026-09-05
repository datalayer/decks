# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The decks API over a directory: create, list, read, replace, delete, refuse."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from datalayer_decks import create_app

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
