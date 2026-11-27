# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The ``decks`` command group, on its own and as a Datalayer CLI plugin."""

from __future__ import annotations

import json
from pathlib import Path

import typer
from fastapi.testclient import TestClient
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


def test_serve_loads_a_yaml_file_and_opens_its_deep_link(
    tmp_path: Path, monkeypatch: object
) -> None:
    deck = tmp_path / "My Welcome.yaml"
    deck.write_text(
        """deck:\n  title: Welcome\n  template: datalayer\nslides:\n  - type: title\n    title: Hello\n"""
    )
    captured: dict[str, object] = {}

    def run(application: object, **options: object) -> None:
        captured["decks"] = TestClient(application).get("/decks").json()
        captured["options"] = options

    monkeypatch.setattr("reactor.host.run_reactor_host", run)
    result = runner.invoke(app, ["serve", str(deck), "--no-ui", "--no-open"])

    assert result.exit_code == 0, result.output
    records = captured["decks"]
    assert isinstance(records, list)
    assert records[0]["id"] == "local/my-welcome"
    assert records[0]["spec"]["deck"]["title"] == "Welcome"
    assert "http://127.0.0.1:8797/decks/local/my-welcome" in result.output


def test_serve_names_the_reactor_plugins_to_the_interface(tmp_path: Path, monkeypatch: object) -> None:
    """``--reactor-plugins``: repeatable, comma-separated, deduplicated, and answered at ``/config``."""
    captured: dict[str, object] = {}

    def run(application: object, **options: object) -> None:
        captured["config"] = TestClient(application).get("/config").json()

    monkeypatch.setattr("reactor.host.run_reactor_host", run)
    result = runner.invoke(
        app,
        [
            "serve", "--no-ui", "--no-open", "--decks-dir", str(tmp_path),
            "--reactor-plugins", "ai-agents,graph", "--reactor-plugins", "ai-agents",
        ],
    )
    assert result.exit_code == 0, result.output
    assert captured["config"]["reactor_plugins"] == ["ai-agents", "graph"]
    assert "Reactor plugins: ai-agents, graph" in result.output

    plain = runner.invoke(app, ["serve", "--no-ui", "--no-open", "--decks-dir", str(tmp_path)])
    assert plain.exit_code == 0, plain.output
    assert captured["config"]["reactor_plugins"] == []
    assert "Reactor plugins:" not in plain.output


def test_every_description_keeps_the_house_style() -> None:
    # The line a listing shows beside a command, as the Datalayer CLI lists
    # this package's: one sentence ending with a period, a capital, short
    # enough not to wrap, not opening with the command's own name.
    from reactor.cli import help_style_violations

    host = typer.Typer(name="datalayer")
    host.command("other", help="Do the other thing.")(lambda: None)
    host.add_typer(app)

    assert help_style_violations(host) == []


def test_pdf_prints_in_the_theme_asked_else_the_decks_own() -> None:
    from datalayer_decks.cli import _print_query

    deck = {"deck": {"title": "T", "theme": "metal", "colorMode": "dark"}}
    assert _print_query(deck, None, None) == "theme=metal&mode=dark"
    assert _print_query(deck, "datalayer", "light") == "theme=datalayer&mode=light"
    assert _print_query({"deck": {"title": "T"}}, None, None) == "mode=light"


def test_pdf_is_a_command_of_the_group() -> None:
    result = CliRunner().invoke(app, ["pdf", "--help"])
    assert result.exit_code == 0
    assert "--max-pages" in result.output
    assert CliRunner().invoke(app, ["collage", "--help"]).exit_code == 0


def test_collage_fills_the_smallest_square_unless_told() -> None:
    from datalayer_decks.cli import _collage_columns

    assert _collage_columns(10, None) == 4
    assert _collage_columns(9, None) == 3
    assert _collage_columns(1, None) == 1
    assert _collage_columns(10, 5) == 5
