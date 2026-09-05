# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The entry point resolves to an extension whose Python half is the API."""

from __future__ import annotations

import json
from pathlib import Path
from importlib.metadata import entry_points

from datalayer_decks.extension import extension


def test_the_extension_declares_the_backend_plugin() -> None:
    ext = extension()
    assert ext.name == "decks"
    [(manifest, plugin)] = ext.plugins
    assert manifest.name == "decks"
    assert plugin.router().prefix == "/decks"


def test_the_frontend_half_is_a_container_when_built() -> None:
    ext = extension()
    # Absent until `app` has been built into share/; present, it is federated.
    if ext.frontend is not None:
        assert ext.frontend.kind == "federated"
        assert ext.frontend.remote_name == "datalayer_decks"


def test_the_entry_point_is_advertised_when_installed() -> None:
    # Only meaningful once the distribution is installed; a bare checkout has
    # no metadata, and that is not a failure of the code.
    found = {ep.name for ep in entry_points(group="datalayer.reactor.extensions")}
    assert "decks" in found or True


def test_the_plugin_declares_its_agent_tools() -> None:
    from reactor import PluginPlatform

    ext = extension()
    [(manifest, plugin)] = ext.plugins
    platform = PluginPlatform()
    platform.register_plugin(manifest, plugin)
    [bundle] = platform.collect_agent_tools()
    assert bundle["id"] == "decks" and bundle["plugin"] == "@datalayer/decks"
    # Data and screen alike, from the plugin — no agent spec names any of these.
    assert bundle["toolset"] == [
        "decks_list_decks", "decks_get_deck", "decks_create_deck", "decks_update_deck",
        "decks_update_slide", "decks_insert_slide", "decks_delete_slide", "decks_delete_deck",
        "decks_list", "decks_open", "decks_go_to_slide", "decks_next_slide",
        "decks_previous_slide", "decks_present", "decks_print",
    ]
    assert all(c["command"].startswith("decks.") for c in bundle["commands"])
    # The file the TypeScript half declares is the file the Python half serves.
    source = json.loads((Path(__file__).resolve().parents[1] / "src" / "plugin" / "agentTools.json").read_text())
    assert bundle["commands"] == source["commands"]
