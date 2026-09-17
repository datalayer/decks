# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The decks plugin's commands, on the Python side.

The twin of what ``src/plugin/index.tsx`` registers in the browser. A command
is the unit both halves are built on: the TypeScript plugin registers fifteen
of them — the data ones and the ones that drive a deck on screen — and
``agentTools.json`` names each as ``{"name": "decks_get_deck", "command":
"decks.getDeck"}``. The Python plugin serves that same bundle from
``GET /plugins/agent-tools`` while registering no command at all, so an agent
runtime that read the bundle from a headless host found tools naming commands
the reactor did not have. This is the missing half: the same ids, the same
arguments, the same answers, against the :class:`~datalayer_decks.storage.DeckStore`
instead of the browser's catalog.

**The data commands only, and deliberately.** ``decks.open``, ``goToSlide``,
``nextSlide``, ``previousSlide``, ``present`` and ``print`` move a deck on a
screen; a store has no screen, and a command answering "not here" for every
call is worse than a registry that plainly does not offer it. A host with a
browser gets those from the TypeScript plugin, in the same registry, under the
same ids — which is what makes one bundle describe both halves.

Every answer matches ``plugin/answers.ts`` field for field: a summary to choose
a deck with, an outline to find "the metrics slide" in, and what validation
noticed after a write. Slide numbers are 1-based here as there, because the
outline a model reads them from is.

@module datalayer_decks.commands
"""

from __future__ import annotations

import json
from typing import Any, Mapping

from reactor import Command, PluginCommands

from .storage import DeckNotFound, DeckRecord, DeckStore, deck_id, split_id

#: The ids of the data commands, as the TypeScript half spells them. The
#: bundle in ``agent_tools.json`` names these; a test keeps the two equal.
DECKS_DATA_COMMANDS: dict[str, str] = {
    "listDecks": "decks.listDecks",
    "getDeck": "decks.getDeck",
    "createDeck": "decks.createDeck",
    "updateDeck": "decks.updateDeck",
    "updateSlide": "decks.updateSlide",
    "insertSlide": "decks.insertSlide",
    "deleteSlide": "decks.deleteSlide",
    "deleteDeck": "decks.deleteDeck",
}

#: The commands that need a screen. Registered by the TypeScript plugin in a
#: host that has one; named here so the reason they are absent is written down
#: where somebody looking for them will find it.
DECKS_SCREEN_COMMANDS: tuple[str, ...] = (
    "decks.list",
    "decks.open",
    "decks.goToSlide",
    "decks.nextSlide",
    "decks.previousSlide",
    "decks.present",
    "decks.print",
)


# -- Reading an argument ------------------------------------------------------


def _argument(value: Any) -> Mapping[str, Any]:
    """A command's argument as a mapping.

    ``reactor commands run decks.getDeck '{"id": "local/talk"}'`` hands over a
    string, and a model sometimes passes its JSON as text too; both mean the
    object they spell.
    """
    if value is None:
        return {}
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError as error:
            raise ValueError(f"The argument is not valid JSON: {error}") from None
    if not isinstance(value, Mapping):
        raise ValueError("The argument must be an object.")
    return value


def _id_of(argument: Mapping[str, Any]) -> str:
    identifier = argument.get("id")
    if not isinstance(identifier, str) or not identifier:
        raise ValueError("Which deck? Pass its `id`, as listed by decks_list_decks.")
    return identifier


def _slide_of(argument: Mapping[str, Any]) -> int:
    slide = argument.get("slide")
    if isinstance(slide, bool) or not isinstance(slide, int):
        raise ValueError("Pass the 1-based `slide` number, from the deck's outline.")
    return slide


def _spec_of(argument: Mapping[str, Any], key: str = "spec") -> dict[str, Any]:
    spec = argument.get(key)
    if isinstance(spec, str):
        try:
            spec = json.loads(spec)
        except json.JSONDecodeError:
            raise ValueError(f"`{key}` is not valid JSON.") from None
    if not isinstance(spec, Mapping):
        raise ValueError(f"`{key}` must be an object.")
    return dict(spec)


def _text_of(value: Any) -> str:
    """An optional string argument — a ``slug`` or a ``collection``."""
    return value if isinstance(value, str) else ""


def _existing(store: DeckStore, identifier: str) -> DeckRecord:
    try:
        return store.get(identifier)
    except DeckNotFound:
        raise ValueError(f"There is no deck {identifier}.") from None


def _slides_of(record: DeckRecord) -> list[Any]:
    slides = record.spec.get("slides")
    return list(slides) if isinstance(slides, list) else []


def _at(slide: int, count: int) -> int:
    """A 1-based slide number the deck has, or a sentence saying it does not."""
    if count == 0:
        raise ValueError(f"Deck {slide} has no slides yet.")
    if slide < 1 or slide > count:
        raise ValueError(f"The deck has slides 1 to {count}; there is no slide {slide}.")
    return slide


# -- What a command answers with ----------------------------------------------


def deck_summary(record: DeckRecord) -> dict[str, Any]:
    """A deck in a list: enough to choose it and to address it."""
    meta = record.spec.get("deck") if isinstance(record.spec.get("deck"), Mapping) else {}
    return {
        "id": record.id,
        "collection": record.collection,
        "slug": record.slug,
        "title": meta.get("title", ""),
        "subtitle": meta.get("subtitle"),
        "slides": len(_slides_of(record)),
        "source": "server",
    }


def deck_outline(spec: Mapping[str, Any]) -> list[dict[str, Any]]:
    """Slide number, type and title of every slide."""
    slides = spec.get("slides")
    if not isinstance(slides, list):
        return []
    outline = []
    for index, slide in enumerate(slides):
        fields = slide if isinstance(slide, Mapping) else {}
        title = fields.get("title") or fields.get("statement") or fields.get("quote") or ""
        outline.append(
            {
                "slide": index + 1,
                "type": str(fields.get("type", "unknown")),
                "title": str(title)[:80],
            }
        )
    return outline


def deck_details(record: DeckRecord) -> dict[str, Any]:
    """The whole deck, for reading before changing it."""
    return {**deck_summary(record), "spec": record.spec, "outline": deck_outline(record.spec)}


def deck_issues(spec: Mapping[str, Any]) -> list[str]:
    """What is wrong with a spec, as far as this tier can tell.

    The structure only — a title, at least one slide, a type on each. What a
    *kind* of slide needs is the engine's table (``src/validation.ts``), which
    knows the templates and the registered components; duplicating it here
    would be a second answer to the same question, drifting from the first.
    So: no issues means nothing structurally wrong, not that it draws.
    """
    issues: list[str] = []
    meta = spec.get("deck")
    if not isinstance(meta, Mapping) or not meta.get("title"):
        issues.append("deck: A deck needs a `title`.")
    slides = spec.get("slides")
    if not isinstance(slides, list) or not slides:
        issues.append("slides: A deck needs at least one slide.")
        return issues
    for index, slide in enumerate(slides):
        if not isinstance(slide, Mapping) or not slide.get("type"):
            issues.append(f"slides[{index}]: A slide needs a `type`.")
    return issues


def deck_written(record: DeckRecord) -> dict[str, Any]:
    """What a write answers: the deck as it now is, and what validation noticed."""
    return {
        **deck_summary(record),
        "outline": deck_outline(record.spec),
        "issues": deck_issues(record.spec),
    }


# -- The commands themselves --------------------------------------------------


def _write_slides(store: DeckStore, identifier: str, slides: list[Any]) -> DeckRecord:
    record = _existing(store, identifier)
    spec = {**record.spec, "slides": slides}
    return store.put(record.collection, record.slug, spec)


def register_deck_commands(commands: PluginCommands, store: DeckStore) -> None:
    """Register the deck data commands against *store*.

    Called from the plugin's ``provide_slash_commands``; separate from it so a
    host with a store of its own — a test, a notebook — can register the suite
    without building an extension.
    """

    def list_decks() -> list[dict[str, Any]]:
        return [deck_summary(record) for record in store.list()]

    def get_deck(argument: Any = None) -> dict[str, Any]:
        return deck_details(_existing(store, _id_of(_argument(argument))))

    def create_deck(argument: Any = None) -> dict[str, Any]:
        arguments = _argument(argument)
        slug = _text_of(arguments.get("slug"))
        if not slug:
            raise ValueError("A new deck needs a `slug`: the short name in its address.")
        spec = _spec_of(arguments)
        return deck_written(store.put(_text_of(arguments.get("collection")), slug, spec))

    def update_deck(argument: Any = None) -> dict[str, Any]:
        arguments = _argument(argument)
        identifier = _id_of(arguments)
        existing = _existing(store, identifier)
        spec = _spec_of(arguments)
        collection = _text_of(arguments.get("collection")) or existing.collection
        slug = _text_of(arguments.get("slug")) or existing.slug
        record = store.put(collection, slug, spec)
        # A new address is a move, not a copy: the deck was at one id and is
        # now at another, and leaving the old one behind would list twice.
        if record.id != existing.id:
            store.delete(existing.id)
        return deck_written(record)

    def update_slide(argument: Any = None) -> dict[str, Any]:
        arguments = _argument(argument)
        identifier = _id_of(arguments)
        slides = _slides_of(_existing(store, identifier))
        at = _at(_slide_of(arguments), len(slides))
        slides[at - 1] = _spec_of(arguments, "slide_spec")
        return deck_written(_write_slides(store, identifier, slides))

    def insert_slide(argument: Any = None) -> dict[str, Any]:
        arguments = _argument(argument)
        identifier = _id_of(arguments)
        slides = _slides_of(_existing(store, identifier))
        # Before the given position; past the end appends, as in the browser.
        at = max(1, min(_slide_of(arguments), len(slides) + 1))
        slides.insert(at - 1, _spec_of(arguments, "slide_spec"))
        return deck_written(_write_slides(store, identifier, slides))

    def delete_slide(argument: Any = None) -> dict[str, Any]:
        arguments = _argument(argument)
        identifier = _id_of(arguments)
        slides = _slides_of(_existing(store, identifier))
        at = _at(_slide_of(arguments), len(slides))
        if len(slides) == 1:
            raise ValueError("A deck needs at least one slide; delete the deck instead.")
        del slides[at - 1]
        return deck_written(_write_slides(store, identifier, slides))

    def delete_deck(argument: Any = None) -> dict[str, Any]:
        identifier = _id_of(_argument(argument))
        _existing(store, identifier)
        store.delete(identifier)
        return {"ok": True, "id": identifier}

    registrations: list[tuple[str, str, str, Any, str]] = [
        (
            DECKS_DATA_COMMANDS["listDecks"],
            "List the decks",
            "Every deck in the store: id, title, slide count",
            list_decks,
            "\U0001f4ca",
        ),
        (
            DECKS_DATA_COMMANDS["getDeck"],
            "Read a deck",
            "A deck's spec and outline, by id",
            get_deck,
            "",
        ),
        (
            DECKS_DATA_COMMANDS["createDeck"],
            "Create a deck",
            "A deck from a complete spec, under a slug",
            create_deck,
            "✨",
        ),
        (
            DECKS_DATA_COMMANDS["updateDeck"],
            "Replace a deck",
            "A deck's whole record — collection, slug, spec — by id",
            update_deck,
            "",
        ),
        (
            DECKS_DATA_COMMANDS["updateSlide"],
            "Replace a slide",
            "One slide of a deck, by its 1-based number",
            update_slide,
            "",
        ),
        (
            DECKS_DATA_COMMANDS["insertSlide"],
            "Insert a slide",
            "A slide before the given 1-based position",
            insert_slide,
            "",
        ),
        (
            DECKS_DATA_COMMANDS["deleteSlide"],
            "Delete a slide",
            "One slide of a deck, by its 1-based number",
            delete_slide,
            "",
        ),
        (
            DECKS_DATA_COMMANDS["deleteDeck"],
            "Delete a deck",
            "Remove a deck by id. Irreversible.",
            delete_deck,
            "",
        ),
    ]
    for order, (identifier, name, description, execute, emoji) in enumerate(registrations):
        commands.register(
            Command(
                id=identifier,
                name=name,
                description=description,
                execute=execute,
                category="Decks",
                octicon="project",
                emoji=emoji,
                order=order,
            )
        )


__all__ = [
    "DECKS_DATA_COMMANDS",
    "DECKS_SCREEN_COMMANDS",
    "deck_details",
    "deck_issues",
    "deck_outline",
    "deck_summary",
    "deck_written",
    "register_deck_commands",
]

# `deck_id` and `split_id` are imported for the address arithmetic above; the
# re-export keeps them reachable from this module for a host doing its own.
_ = (deck_id, split_id)
