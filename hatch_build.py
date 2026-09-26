# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""Build the JavaScript halves into ``share/`` when the wheel is built.

The wheel carries two things besides the Python package: the standalone
interface (``share/datalayer/reactor/apps/decks``) and the Module Federation
container that lets any Reactor host load the decks plugin
(``share/datalayer/reactor/extensions/decks``). Both are ``npm`` builds, and
a wheel without them is a server with no face — so ``hatch build`` runs them
when they are missing, and only then: a checkout that ran ``make build`` first,
or a CI job that built the JavaScript in a step of its own, is not made to do
it twice. Set ``DATALAYER_DECKS_SKIP_JS=1`` to build the wheel without either
(a Python-only development install, say).
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface

ROOT = Path(__file__).parent
APP = ROOT / "share" / "datalayer" / "reactor" / "apps" / "decks" / "index.html"
CONTAINER = ROOT / "share" / "datalayer" / "reactor" / "extensions" / "decks" / "remoteEntry.js"


class JavaScriptBuildHook(BuildHookInterface):
    PLUGIN_NAME = "custom"

    def initialize(self, version: str, build_data: dict) -> None:  # noqa: ARG002
        # An editable install (`pip install -e .`) is a development checkout:
        # its JavaScript is built by `make`, when and if the developer wants it,
        # not by pip. Only a real wheel must carry the built halves.
        if version == "editable" or os.environ.get("DATALAYER_DECKS_SKIP_JS"):
            return
        missing = [name for name, marker in (("interface", APP), ("container", CONTAINER)) if not marker.is_file()]
        if not missing:
            return
        npm = shutil.which("npm")
        if npm is None:
            raise RuntimeError(
                f"The wheel needs the built {' and '.join(missing)} under share/, and npm is not "
                "on PATH to build them. Run `make build` first, or set DATALAYER_DECKS_SKIP_JS=1."
            )
        workspace = ROOT.parent.parent.parent / "node_modules"
        if not (ROOT / "node_modules").is_dir() and not workspace.is_dir():
            subprocess.run([npm, "install"], cwd=ROOT, check=True)
        # The interface (app/) is a package of its own, never a workspace
        # member: nothing hoists its dependencies, and its bundler has to be
        # its own -- after a `git clean`, app/ otherwise resolves whatever
        # rsbuild the workspace hoisted, which is not the one it was written
        # against. The plugin is a workspace member when there is a workspace
        # (hoisted, nothing to install: `npm install` inside a member would
        # redirect to the whole workspace) and a package of its own in a plain
        # checkout, where CI installs it too.
        own = [ROOT / "app"]
        if not workspace.is_dir():
            own.append(ROOT / "plugins" / "ai-agents")
        for package in own:
            if not (package / "node_modules").is_dir():
                self.app.display_info(f"Installing {package.relative_to(ROOT)}'s dependencies ...")
                subprocess.run([npm, "install", "--no-audit", "--no-fund"], cwd=package, check=True)
        self.app.display_info(f"Building the {' and '.join(missing)} into share/ ...")
        subprocess.run([npm, "run", "build:all"], cwd=ROOT, check=True)
        for name, marker in (("interface", APP), ("container", CONTAINER)):
            if not marker.is_file():
                raise RuntimeError(f"The {name} build finished but {marker} is not there.")
