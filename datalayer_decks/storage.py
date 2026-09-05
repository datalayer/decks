# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""Where decks live on disk: one JSON file per deck, in one directory.

A deck is data, so its storage is the plainest thing that holds data: a file
named after the deck, in a directory the operator can back up, version and
read with ``cat``. No database, because a presentation does not need one and
a dependency it does not need is one more thing to install before the first
slide is on screen.

Addresses follow the frontend's: a deck of a family is ``family/slug.json``,
a standalone one ``slug.json``. The id the API speaks is the address without
the extension.
"""

from __future__ import annotations

import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

#: Where decks are kept when nothing says otherwise.
DEFAULT_DECKS_DIR = Path(os.environ.get("DATALAYER_DECKS_DIR", "~/.datalayer/decks")).expanduser()

_SEGMENT = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")


class DeckNotFound(KeyError):
    """No deck at that id."""


class InvalidDeckId(ValueError):
    """An id that could reach outside the directory, or is not an address."""


@dataclass(frozen=True)
class DeckRecord:
    """One stored deck, as the API returns it."""

    id: str
    collection: str
    slug: str
    spec: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "collection": self.collection, "slug": self.slug, "spec": self.spec}


def deck_id(collection: str, slug: str) -> str:
    return f"{collection}/{slug}" if collection else slug


def split_id(identifier: str) -> tuple[str, str]:
    """``family/slug`` → ``("family", "slug")``; ``slug`` → ``("", "slug")``.

    Every segment is checked against a strict pattern before it becomes part
    of a path: this is the only defence between a URL and the filesystem, so
    ``..``, absolute paths and separators are refused rather than resolved.
    """
    parts = identifier.strip("/").split("/")
    if len(parts) > 2 or not all(_SEGMENT.match(part) for part in parts):
        raise InvalidDeckId(identifier)
    return (parts[0], parts[1]) if len(parts) == 2 else ("", parts[0])


class DeckStore:
    """The directory of decks."""

    def __init__(self, directory: Path | str | None = None) -> None:
        self.directory = Path(directory).expanduser() if directory else DEFAULT_DECKS_DIR

    def _path(self, identifier: str) -> Path:
        collection, slug = split_id(identifier)
        return self.directory / collection / f"{slug}.json" if collection else self.directory / f"{slug}.json"

    def list(self) -> list[DeckRecord]:
        if not self.directory.is_dir():
            return []
        records: list[DeckRecord] = []
        for path in sorted(self.directory.rglob("*.json")):
            relative = path.relative_to(self.directory).with_suffix("")
            parts = relative.parts
            if len(parts) > 2:
                continue  # deeper than an address can say; not ours
            collection, slug = (parts[0], parts[1]) if len(parts) == 2 else ("", parts[0])
            try:
                spec = json.loads(path.read_text())
            except json.JSONDecodeError:
                continue  # a half-written file is not a deck yet
            records.append(DeckRecord(deck_id(collection, slug), collection, slug, spec))
        return records

    def get(self, identifier: str) -> DeckRecord:
        path = self._path(identifier)
        if not path.is_file():
            raise DeckNotFound(identifier)
        collection, slug = split_id(identifier)
        return DeckRecord(deck_id(collection, slug), collection, slug, json.loads(path.read_text()))

    def put(self, collection: str, slug: str, spec: dict[str, Any]) -> DeckRecord:
        identifier = deck_id(collection, slug)
        path = self._path(identifier)
        path.parent.mkdir(parents=True, exist_ok=True)
        # Written beside and renamed over: a reader listing the directory never
        # sees half a deck, and a crash mid-write leaves the old one intact.
        temporary = path.with_suffix(".json.tmp")
        temporary.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n")
        temporary.replace(path)
        return DeckRecord(identifier, collection, slug, spec)

    def delete(self, identifier: str) -> None:
        path = self._path(identifier)
        if not path.is_file():
            raise DeckNotFound(identifier)
        path.unlink()
