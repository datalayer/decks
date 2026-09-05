# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The standalone host: one decks plugin, discovered, and its API on the same store."""

from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from datalayer_decks.host import create_app


def test_the_plugin_is_registered_once_and_the_api_uses_its_store(tmp_path: Path) -> None:
    app = create_app(with_ui=False, decks_dir=tmp_path)
    platform = app.state.reactor
    names = [record["name"] for record in platform.list_plugins()]
    assert names.count("decks") == 1
    client = TestClient(app)
    created = client.post(
        "/decks",
        json={"collection": "t", "slug": "one", "spec": {"deck": {"title": "One"}, "slides": []}},
    )
    assert created.status_code == 201
    assert (tmp_path / "t" / "one.json").is_file()
    assert [d["id"] for d in client.get("/decks").json()] == ["t/one"]
    # The plugin the API answers for is the discovered one, over the same directory.
    plugin = platform.implementation_of("decks")
    assert plugin is not None and Path(plugin.store.directory) == tmp_path
