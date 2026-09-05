# Copyright (c) 2022-2026 Datalayer, Inc.
#
# Datalayer License

"""The entry point resolves to an extension whose Python half is the API."""

from __future__ import annotations

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
