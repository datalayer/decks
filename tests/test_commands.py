# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The plugin registers the deck commands the agent tools name.

The bundle in ``agentTools.json`` is one file describing two halves: what the
browser plugin registers, and what this tier does. The tests below hold the
Python half to it — the data commands under the same ids, reading and writing
the store, answering in the shapes ``plugin/answers.ts`` defines — and record
why the rest are absent.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest
from reactor import PluginPlatform

from datalayer_decks.commands import (
    DECKS_DATA_COMMANDS,
    DECKS_SCREEN_COMMANDS,
    deck_issues,
    deck_outline,
)
from datalayer_decks.extension import extension
from datalayer_decks.storage import DeckStore

BUNDLE = json.loads(
    (Path(__file__).resolve().parents[1] / "src" / "plugin" / "agentTools.json").read_text()
)


def a_deck(title: str = "A talk") -> dict:
    return {
        "deck": {"title": title, "template": "datalayer"},
        "slides": [
            {"type": "title", "title": title},
            {"type": "bullets", "title": "Why", "items": ["a", "b"]},
        ],
    }


@pytest.fixture
def platform(tmp_path) -> PluginPlatform:
    """The extension registered on a platform, over a store of its own."""
    store = DeckStore(tmp_path)
    store.put("local", "talk", a_deck())
    ext = extension(store)
    [(manifest, plugin)] = ext.plugins
    platform = PluginPlatform()
    platform.register_plugin(manifest, plugin)
    return platform


def run(platform: PluginPlatform, command_id: str, argument=None):
    return asyncio.run(platform.execute_command(command_id, argument))


# -- The suite ----------------------------------------------------------------


def test_registering_the_plugin_registers_the_data_commands(platform) -> None:
    registered = [entry["id"] for entry in platform.describe_commands()]
    assert registered == list(DECKS_DATA_COMMANDS.values())
    # Every one of them is a command the bundle names, so an agent reading
    # `GET /plugins/agent-tools` finds what it calls.
    declared = {command["command"] for command in BUNDLE["commands"]}
    assert set(registered) <= declared
    # And what the bundle names beyond them is exactly the screen half, which
    # a store has no way to do.
    assert declared - set(registered) == set(DECKS_SCREEN_COMMANDS)


def test_the_commands_say_what_they_are_before_they_run(platform) -> None:
    for entry in platform.describe_commands():
        assert entry["plugin"] == "decks"
        assert entry["category"] == "Decks"
        assert entry["name"] and entry["description"]


def test_dropping_the_plugin_drops_its_commands(platform) -> None:
    platform.unregister_plugin("decks")
    assert platform.describe_commands() == []


# -- Reading ------------------------------------------------------------------


def test_listing_and_reading_a_deck(platform) -> None:
    [summary] = run(platform, "decks.listDecks")
    assert summary["id"] == "local/talk"
    assert (summary["collection"], summary["slug"]) == ("local", "talk")
    assert (summary["title"], summary["slides"]) == ("A talk", 2)

    details = run(platform, "decks.getDeck", {"id": "local/talk"})
    assert details["spec"] == a_deck()
    assert details["outline"] == [
        {"slide": 1, "type": "title", "title": "A talk"},
        {"slide": 2, "type": "bullets", "title": "Why"},
    ]


def test_an_argument_may_arrive_as_json_text(platform) -> None:
    # `reactor commands run decks.getDeck '{"id": "local/talk"}'`.
    assert run(platform, "decks.getDeck", '{"id": "local/talk"}')["id"] == "local/talk"


def test_a_missing_or_unknown_deck_answers_a_sentence(platform) -> None:
    with pytest.raises(ValueError, match="Which deck"):
        run(platform, "decks.getDeck", {})
    with pytest.raises(ValueError, match="There is no deck local/nope"):
        run(platform, "decks.getDeck", {"id": "local/nope"})
    with pytest.raises(ValueError, match="not valid JSON"):
        run(platform, "decks.getDeck", "{not json")


# -- Writing ------------------------------------------------------------------


def test_creating_a_deck_stores_it_and_reports_what_validation_noticed(platform) -> None:
    written = run(
        platform, "decks.createDeck", {"slug": "second", "spec": a_deck("Another")}
    )
    assert (written["id"], written["slides"], written["issues"]) == ("second", 2, [])
    assert {deck["id"] for deck in run(platform, "decks.listDecks")} == {"local/talk", "second"}

    # A spec that is not a deck is reported, not swallowed.
    broken = run(
        platform, "decks.createDeck", {"slug": "broken", "spec": {"deck": {}, "slides": []}}
    )
    assert broken["issues"] == [
        "deck: A deck needs a `title`.",
        "slides: A deck needs at least one slide.",
    ]

    with pytest.raises(ValueError, match="needs a `slug`"):
        run(platform, "decks.createDeck", {"spec": a_deck()})


def test_replacing_a_deck_under_a_new_address_moves_it(platform) -> None:
    written = run(
        platform,
        "decks.updateDeck",
        {"id": "local/talk", "slug": "renamed", "spec": a_deck("Renamed")},
    )
    assert written["id"] == "local/renamed"
    # Moved, not copied: the old address is gone.
    assert [deck["id"] for deck in run(platform, "decks.listDecks")] == ["local/renamed"]


def test_editing_slides_by_their_1_based_number(platform) -> None:
    written = run(
        platform,
        "decks.insertSlide",
        {"id": "local/talk", "slide": 99, "slide_spec": {"type": "closing", "title": "Bye"}},
    )
    assert [entry["type"] for entry in written["outline"]] == ["title", "bullets", "closing"]

    run(
        platform,
        "decks.updateSlide",
        {"id": "local/talk", "slide": 2, "slide_spec": {"type": "statement", "statement": "One"}},
    )
    written = run(platform, "decks.deleteSlide", {"id": "local/talk", "slide": 3})
    assert written["outline"] == [
        {"slide": 1, "type": "title", "title": "A talk"},
        {"slide": 2, "type": "statement", "title": "One"},
    ]
    # The edits are on disk, not only in the answer.
    assert run(platform, "decks.getDeck", {"id": "local/talk"})["spec"]["slides"][1] == {
        "type": "statement",
        "statement": "One",
    }


def test_a_slide_the_deck_does_not_have_is_refused(platform) -> None:
    for command in ("decks.updateSlide", "decks.deleteSlide"):
        with pytest.raises(ValueError, match="slides 1 to 2"):
            run(platform, command, {"id": "local/talk", "slide": 5, "slide_spec": {"type": "title"}})
    with pytest.raises(ValueError, match="1-based `slide`"):
        run(platform, "decks.deleteSlide", {"id": "local/talk", "slide": "two"})


def test_the_last_slide_is_kept_and_the_deck_deleted_instead(platform) -> None:
    run(platform, "decks.deleteSlide", {"id": "local/talk", "slide": 2})
    with pytest.raises(ValueError, match="delete the deck instead"):
        run(platform, "decks.deleteSlide", {"id": "local/talk", "slide": 1})

    assert run(platform, "decks.deleteDeck", {"id": "local/talk"}) == {
        "ok": True,
        "id": "local/talk",
    }
    assert run(platform, "decks.listDecks") == []
    with pytest.raises(ValueError, match="There is no deck"):
        run(platform, "decks.deleteDeck", {"id": "local/talk"})


# -- The answer shapes, on their own -------------------------------------------


def test_an_outline_names_a_slide_by_whichever_title_it_has() -> None:
    assert deck_outline({"slides": [{"type": "quote", "quote": "Less is more"}, {}]}) == [
        {"slide": 1, "type": "quote", "title": "Less is more"},
        {"slide": 2, "type": "unknown", "title": ""},
    ]


def test_issues_are_structural_only() -> None:
    # A slide type this tier never heard of is not an issue here: what a kind
    # of slide needs is the engine's table, not a second copy of it.
    assert deck_issues({"deck": {"title": "T"}, "slides": [{"type": "invented"}]}) == []
    assert deck_issues({"deck": {"title": "T"}, "slides": [{"title": "no type"}]}) == [
        "slides[0]: A slide needs a `type`."
    ]
