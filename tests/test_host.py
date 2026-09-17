# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The standalone host: only Decks, and its API on the same store."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from datalayer_decks.host import create_app


def test_the_plugin_is_registered_once_and_the_api_uses_its_store(tmp_path: Path) -> None:
    app = create_app(with_ui=False, decks_dir=tmp_path)
    platform = app.state.reactor
    names = [record["name"] for record in platform.list_plugins()]
    assert names == ["decks"]
    client = TestClient(app)
    created = client.post(
        "/decks",
        json={"collection": "t", "slug": "one", "spec": {"deck": {"title": "One"}, "slides": []}},
    )
    assert created.status_code == 201
    assert (tmp_path / "t" / "one.json").is_file()
    assert [d["id"] for d in client.get("/decks").json()] == ["t/one"]
    assert client.get("/plugins/frontend-extensions").json() == []
    assert [record["name"] for record in platform.list_plugins()] == ["decks"]
    # The plugin the API answers for is the registered one, over the same directory.
    plugin = platform.implementation_of("decks")
    assert plugin is not None and Path(plugin.store.directory) == tmp_path


def test_the_host_says_what_it_was_started_with(tmp_path: Path, monkeypatch) -> None:
    """``/config`` is how the interface learns which optional plugins to build."""
    monkeypatch.delenv("DATALAYER_AI_INFERENCE_URL", raising=False)
    bare = TestClient(create_app(with_ui=False, decks_dir=tmp_path))
    assert bare.get("/config").json() == {"reactor_plugins": [], "ai_inference_url": None}

    monkeypatch.setenv("DATALAYER_AI_INFERENCE_URL", "https://inference.example")
    configured = TestClient(
        create_app(with_ui=False, decks_dir=tmp_path, reactor_plugins=["ai-agents"])
    )
    assert configured.get("/config").json() == {
        "reactor_plugins": ["ai-agents"],
        "ai_inference_url": "https://inference.example",
    }
    # An explicit URL wins over the environment.
    explicit = TestClient(
        create_app(with_ui=False, decks_dir=tmp_path, ai_inference_url="https://other.example")
    )
    assert explicit.get("/config").json()["ai_inference_url"] == "https://other.example"
