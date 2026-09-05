# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The ``decks`` command group, on its own and as a Datalayer CLI plugin."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from typer.testing import CliRunner

from datalayer_decks.cli import app, plugin
from datalayer_decks.storage import DeckStore

runner = CliRunner()
SPEC = {"deck": {"title": "Hello"}, "slides": [{"type": "title", "title": "Hi"}]}


def test_list_show_delete(tmp_path: Path) -> None:
    store = DeckStore(tmp_path)
    store.put("talks", "hello", SPEC)
    listed = runner.invoke(app, ["list", "--decks-dir", str(tmp_path)])
    assert listed.exit_code == 0 and "talks/hello" in listed.output and "Hello" in listed.output
    as_json = runner.invoke(app, ["list", "--decks-dir", str(tmp_path), "--json"])
    assert json.loads(as_json.output)[0]["id"] == "talks/hello"
    shown = runner.invoke(app, ["show", "talks/hello", "--decks-dir", str(tmp_path)])
    assert json.loads(shown.output)["spec"] == SPEC
    missing = runner.invoke(app, ["show", "nope", "--decks-dir", str(tmp_path)])
    assert missing.exit_code == 1
    deleted = runner.invoke(app, ["delete", "talks/hello", "--decks-dir", str(tmp_path), "--yes"])
    assert deleted.exit_code == 0 and store.list() == []


def test_the_plugin_adds_the_group_to_a_host_cli() -> None:
    manifest, extension = plugin()
    assert manifest.name == "decks-cli"
    host = typer.Typer()
    extension.provide_cli(host)
    result = runner.invoke(host, ["decks", "--help"])
    assert result.exit_code == 0
    for command in ("serve", "list", "show", "delete"):
        assert command in result.output
