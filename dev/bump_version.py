#!/usr/bin/env python3
# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""Bump the version, in every file that carries a copy of it.

The version lives in four places. `datalayer_decks/__version__.py` is the
source: hatch reads it (`[tool.hatch.version] path` in pyproject.toml), and
so do the plugin manifests the Python package declares. The three
`package.json` files -- the published `@datalayer/decks`, the published
`@datalayer/decks-plugin-ai-agents`, and the private `@datalayer/decks-app`
-- are copies, and a copy that gets missed ships a package whose manifest
disagrees with the wheel it travels with.

    python dev/bump_version.py patch     # 1.0.3 -> 1.0.4
    python dev/bump_version.py minor     # 1.0.3 -> 1.1.0
    python dev/bump_version.py major     # 1.0.3 -> 2.0.0
    python dev/bump_version.py           # asks

Nothing is written unless **every** file can be updated. Either all of them
move or none do.

@module dev.bump_version
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

#: The file the version is read *from*. Hatch reads it too, which is what
#: makes it the source rather than a fourth copy.
SOURCE = ROOT / "datalayer_decks" / "__version__.py"

#: The copies: every package.json in the repository that carries the version.
COPIES = (
    ROOT / "package.json",
    ROOT / "plugins" / "ai-agents" / "package.json",
    ROOT / "app" / "package.json",
)

PARTS = ("major", "minor", "patch")


class Unbumpable(Exception):
    """A file this script cannot update, named with what it expected.

    Raised before anything is written.
    """


def read_version() -> str:
    text = SOURCE.read_text()
    match = re.search(r'__version__\s*=\s*"([^"]+)"', text)
    if match is None:
        raise Unbumpable(f'{SOURCE.relative_to(ROOT)} has no __version__ = "..."')
    return match.group(1)


def bump(version: str, part: str) -> str:
    """The next version, or a refusal naming what it could not read.

    Only `major.minor.patch`; a pre-release tag would need rules about what
    bumping means for it, and guessing one is worse than saying so.
    """
    match = re.fullmatch(r"(\d+)\.(\d+)\.(\d+)", version)
    if match is None:
        raise Unbumpable(
            f"{version!r} is not major.minor.patch; bump it by hand and say "
            "here what the next one should be"
        )
    major, minor, patch = (int(value) for value in match.groups())
    if part == "major":
        return f"{major + 1}.0.0"
    if part == "minor":
        return f"{major}.{minor + 1}.0"
    return f"{major}.{minor}.{patch + 1}"


def _replace_once(path: Path, pattern: str, replacement: str, current: str) -> str:
    """One substitution, refusing zero and refusing more than one.

    Zero means the file's format changed and this script would be editing
    nothing while reporting success. More than one means the pattern is
    matching something else as well -- a dependency's version, say.
    """
    text = path.read_text()
    found = re.findall(pattern, text, flags=re.M)
    if len(found) != 1:
        raise Unbumpable(
            f"{path.relative_to(ROOT)}: expected exactly one "
            f"{current!r} matching {pattern!r}, found {len(found)}"
        )
    return re.sub(pattern, replacement, text, count=1, flags=re.M)


def planned_edits(current: str, new: str) -> dict[Path, str]:
    """Every file's new content, or an exception. Nothing is written here."""
    escaped = re.escape(current)
    edits: dict[Path, str] = {}
    edits[SOURCE] = _replace_once(
        SOURCE, rf'(__version__\s*=\s*")({escaped})(")', rf"\g<1>{new}\g<3>", current
    )
    for path in COPIES:
        # The package's own "version" is the only top-level one; a
        # dependency's version sits under "dependencies" and is never a bare
        # `"version": "x.y.z"` key, so exactly one match is the healthy case.
        edits[path] = _replace_once(
            path, rf'(^  "version"\s*:\s*")({escaped})(")', rf"\g<1>{new}\g<3>", current
        )
    return edits


def check_json(edits: dict[Path, str]) -> None:
    for path, text in edits.items():
        if path.suffix == ".json":
            try:
                json.loads(text)
            except ValueError as error:
                raise Unbumpable(f"{path.relative_to(ROOT)} would not parse: {error}")


def ask() -> str:
    print(f"Current version: {read_version()}")
    for index, part in enumerate(PARTS, start=1):
        print(f"  {index}) {part:5s} -> {bump(read_version(), part)}")
    while True:
        answer = input("Which? [major/minor/patch] ").strip().lower()
        if answer in PARTS:
            return answer
        if answer in ("1", "2", "3"):
            return PARTS[int(answer) - 1]
        print(f"Say one of: {', '.join(PARTS)}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("part", nargs="?", choices=PARTS, help="what to bump")
    parser.add_argument("--dry-run", action="store_true", help="say what would change and write nothing")
    arguments = parser.parse_args(argv)
    try:
        current = read_version()
        part = arguments.part or ask()
        new = bump(current, part)
        edits = planned_edits(current, new)
        check_json(edits)
    except Unbumpable as error:
        print(f"Refused: {error}", file=sys.stderr)
        print("Nothing was written.", file=sys.stderr)
        return 1
    for path, text in sorted(edits.items()):
        if not arguments.dry_run:
            path.write_text(text)
        print(f"{'would bump' if arguments.dry_run else 'bumped'} {path.relative_to(ROOT)}")
    print(f"{current} -> {new}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
