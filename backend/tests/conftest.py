import socket

import pytest


@pytest.fixture(autouse=True)
def offline_env(monkeypatch):
    """Every test runs as the offline box would: no public routing services."""
    monkeypatch.setenv("OFFLINE_MODE", "1")
    monkeypatch.delenv("OSRM_URL", raising=False)
    from backend import routing
    routing.clear_cache()


@pytest.fixture
def no_network(monkeypatch):
    """Any outbound socket connection raises. The happy path must still pass."""
    def guard(*args, **kwargs):
        raise RuntimeError("Network call attempted in OFFLINE_MODE")

    monkeypatch.setattr(socket.socket, "connect", guard)
