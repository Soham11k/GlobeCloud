from __future__ import annotations

import logging
import secrets
from typing import Optional
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import HTTPException, Request
from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer

from globe.config import get_settings

logger = logging.getLogger("globecloud")

_OAUTH_STATE_MAX_AGE = 600


class OAuthError(Exception):
    """OAuth flow failure with a stable code for frontend error mapping."""

    def __init__(self, code: str, message: str = "") -> None:
        self.code = code
        self.message = message or code
        super().__init__(self.message)


def oauth_redirect_base(request: Request | None = None) -> str:
    """Pick OAuth redirect origin: incoming request if allowed, else OAUTH_REDIRECT_BASE_URL."""
    settings = get_settings()
    configured = settings.oauth_redirect_base_url.rstrip("/")
    if request is None:
        return configured

    incoming = str(request.base_url).rstrip("/")
    allowed = {configured}
    for origin in settings.cors_origin_list:
        if origin != "*":
            allowed.add(origin.rstrip("/"))

    if incoming in allowed:
        return incoming
    return configured


def oauth_redirect_uri(provider: str, base: str | None = None) -> str:
    root = (base or get_settings().oauth_redirect_base_url).rstrip("/")
    return f"{root}/auth/oauth/callback/{provider}"


def oauth_login_error_url(
    provider: str,
    code: str,
    request: Request | None = None,
    *,
    redirect_uri: str | None = None,
) -> str:
    base = oauth_redirect_base(request)
    params: dict[str, str] = {"oauth_error": code, "provider": provider}
    if code == "redirect_mismatch":
        params["redirect_uri"] = redirect_uri or oauth_redirect_uri(provider, base)
    return f"{base}/login?{urlencode(params)}"


def warn_oauth_redirect_host() -> None:
    """Log once at startup if redirect base may mismatch common browser origins."""
    parsed = urlparse(get_settings().oauth_redirect_base_url)
    host = (parsed.hostname or "").lower()
    if host == "127.0.0.1":
        logger.warning(
            "OAUTH_REDIRECT_BASE_URL uses 127.0.0.1 — register both localhost and "
            "127.0.0.1 callback URIs in Google/GitHub, or set OAUTH_REDIRECT_BASE_URL=http://localhost:8000"
        )
    elif host == "localhost":
        logger.info(
            "OAuth redirect uses localhost — also register http://127.0.0.1:PORT/auth/oauth/callback/* "
            "if you sign in via 127.0.0.1 (or rely on request-based redirect when CORS_ORIGINS includes both)"
        )


def _state_serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(get_settings().jwt_secret_key, salt="globe-oauth-state")


def create_oauth_state(
    provider: str,
    invite: Optional[str] = None,
    redirect_base: Optional[str] = None,
) -> str:
    payload: dict[str, str] = {
        "p": provider,
        "n": secrets.token_urlsafe(16),
    }
    if invite:
        payload["i"] = invite[:512]
    if redirect_base:
        payload["r"] = redirect_base.rstrip("/")[:256]
    return _state_serializer().dumps(payload)


def parse_oauth_state(state: Optional[str], provider: str) -> dict[str, str]:
    if not state:
        raise OAuthError("invalid_state")
    try:
        data = _state_serializer().loads(state, max_age=_OAUTH_STATE_MAX_AGE)
    except (BadSignature, BadTimeSignature) as exc:
        raise OAuthError("invalid_state") from exc
    if not isinstance(data, dict) or data.get("p") != provider:
        raise OAuthError("invalid_state")
    return data


def _map_provider_error(body: dict, provider: str) -> str:
    err = str(body.get("error", "")).lower()
    desc = str(body.get("error_description", body.get("error_uri", ""))).lower()
    combined = f"{err} {desc}"
    if "redirect_uri" in combined or "redirect uri" in combined:
        return "redirect_mismatch"
    if err in ("invalid_client", "unauthorized_client") or "client" in combined:
        return "invalid_client"
    if err in ("invalid_grant", "bad_verification_code", "code_expired"):
        return "invalid_grant"
    if "access_denied" in err or "denied" in combined:
        return "access_denied"
    return "provider_error"


def google_authorize_url(request: Request, invite: Optional[str] = None) -> str:
    settings = get_settings()
    if not settings.google_client_id:
        raise HTTPException(status_code=503, detail="Google OAuth not configured")
    state = create_oauth_state("google", invite=invite, redirect_base=oauth_redirect_base(request))
    redirect_uri = oauth_redirect_uri("google", oauth_redirect_base(request))
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "offline",
            "prompt": "select_account",
        }
    )
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


def github_authorize_url(request: Request, invite: Optional[str] = None) -> str:
    settings = get_settings()
    if not settings.github_client_id:
        raise HTTPException(status_code=503, detail="GitHub OAuth not configured")
    state = create_oauth_state("github", invite=invite, redirect_base=oauth_redirect_base(request))
    redirect_uri = oauth_redirect_uri("github", oauth_redirect_base(request))
    params = urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": redirect_uri,
            "scope": "user:email",
            "state": state,
        }
    )
    return f"https://github.com/login/oauth/authorize?{params}"


async def exchange_google_code(
    request: Request, code: str, redirect_base: str | None = None
) -> tuple[str, str, str]:
    settings = get_settings()
    base = redirect_base or oauth_redirect_base(request)
    redirect_uri = oauth_redirect_uri("google", base)
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        if token_resp.status_code >= 400:
            try:
                body = token_resp.json()
            except Exception:
                body = {}
            code_key = _map_provider_error(body, "google")
            logger.warning("Google token exchange failed: %s", body)
            raise OAuthError(code_key)
        token = token_resp.json()
        access = token.get("access_token")
        if not access:
            logger.warning("Google token response missing access_token: %s", list(token.keys()))
            raise OAuthError("provider_error")
        user_resp = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access}"},
        )
        if user_resp.status_code >= 400:
            logger.warning("Google userinfo failed: status=%s", user_resp.status_code)
            raise OAuthError("provider_error")
        profile = user_resp.json()
    email = profile.get("email", "") or ""
    if not email:
        raise OAuthError("missing_email")
    return (
        str(profile.get("sub", "")),
        email,
        profile.get("name", "") or "",
    )


async def exchange_github_code(
    request: Request, code: str, redirect_base: str | None = None
) -> tuple[str, str, str]:
    settings = get_settings()
    base = redirect_base or oauth_redirect_base(request)
    redirect_uri = oauth_redirect_uri("github", base)
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
        )
        try:
            token = token_resp.json()
        except Exception:
            token = {}
        if token_resp.status_code >= 400 or token.get("error"):
            code_key = _map_provider_error(token, "github")
            logger.warning("GitHub token exchange failed: %s", token)
            raise OAuthError(code_key)
        access = token.get("access_token")
        if not access:
            logger.warning("GitHub token response missing access_token: %s", token)
            raise OAuthError("provider_error")
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {access}"},
        )
        if user_resp.status_code >= 400:
            logger.warning("GitHub user API failed: status=%s", user_resp.status_code)
            raise OAuthError("provider_error")
        profile = user_resp.json()
        email = profile.get("email") or ""
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {access}"},
            )
            if emails_resp.status_code == 200:
                emails = emails_resp.json()
                primary = next((e for e in emails if e.get("primary")), None)
                if primary:
                    email = primary.get("email", "")
    if not email:
        raise OAuthError("missing_email")
    provider_user_id = str(profile.get("id", ""))
    name = profile.get("name") or profile.get("login", "")
    return provider_user_id, email, name
