import pytest
from starlette.requests import Request

from globe.auth.oauth import (
    OAuthError,
    oauth_login_error_url,
    oauth_redirect_base,
    oauth_redirect_uri,
    _map_provider_error,
)
from globe.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _request(url: str) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [],
        "query_string": b"",
        "server": ("127.0.0.1", 8000),
        "scheme": "http",
    }
    if url.startswith("http://127.0.0.1"):
        scope["headers"] = [(b"host", b"127.0.0.1:8000")]
    elif url.startswith("http://localhost"):
        scope["headers"] = [(b"host", b"localhost:8000")]
    return Request(scope)


def test_oauth_redirect_uri(monkeypatch):
    monkeypatch.setenv("OAUTH_REDIRECT_BASE_URL", "http://localhost:8000")
    assert oauth_redirect_uri("google") == "http://localhost:8000/auth/oauth/callback/google"


def test_oauth_redirect_base_uses_request_when_in_cors(monkeypatch):
    monkeypatch.setenv("OAUTH_REDIRECT_BASE_URL", "http://localhost:8000")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000")
    req = _request("http://127.0.0.1:8000")
    assert oauth_redirect_base(req) == "http://127.0.0.1:8000"


def test_oauth_redirect_base_falls_back_to_config(monkeypatch):
    monkeypatch.setenv("OAUTH_REDIRECT_BASE_URL", "http://localhost:8000")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:8000")
    req = _request("http://127.0.0.1:8000")
    assert oauth_redirect_base(req) == "http://localhost:8000"


def test_oauth_login_error_url_includes_redirect_uri(monkeypatch):
    monkeypatch.setenv("OAUTH_REDIRECT_BASE_URL", "http://localhost:8000")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000")
    req = _request("http://127.0.0.1:8000")
    url = oauth_login_error_url(
        "google",
        "redirect_mismatch",
        req,
        redirect_uri="http://127.0.0.1:8000/auth/oauth/callback/google",
    )
    assert "oauth_error=redirect_mismatch" in url
    assert "redirect_uri=http" in url
    assert url.startswith("http://127.0.0.1:8000/login?")


@pytest.mark.parametrize(
    "body,expected",
    [
        ({"error": "redirect_uri_mismatch", "error_description": "Bad redirect"}, "redirect_mismatch"),
        ({"error": "invalid_client"}, "invalid_client"),
        ({"error": "invalid_grant"}, "invalid_grant"),
        ({"error": "access_denied"}, "access_denied"),
        ({}, "provider_error"),
    ],
)
def test_map_provider_error(body, expected):
    assert _map_provider_error(body, "google") == expected


def test_oauth_error_carries_code():
    err = OAuthError("invalid_state", "State expired")
    assert err.code == "invalid_state"
    assert err.message == "State expired"
    assert str(err) == "State expired"
