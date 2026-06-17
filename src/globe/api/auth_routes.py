from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr, Field

from globe.auth.oauth import (
    exchange_github_code,
    exchange_google_code,
    github_authorize_url,
    google_authorize_url,
)
from globe.auth.tokens import create_access_token, create_email_token
from globe.config import get_settings
from globe.db.platform_store import PlatformStore, User
from globe.email.resend_service import password_reset_html, send_email, verification_email_html

REFRESH_COOKIE = "globecloud_refresh"
ACCESS_COOKIE = "globecloud_access"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(default="", max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class SessionRequest(BaseModel):
    access_token: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


def _get_store(request: Request) -> PlatformStore:
    store = getattr(request.app.state, "auth_store", None)
    if store is None:
        raise HTTPException(status_code=503, detail="Auth not initialized")
    return store


def _set_refresh_cookie(response: Response, token: str) -> None:
    settings = get_settings()
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.oauth_redirect_base_url.startswith("https"),
        samesite="lax",
        max_age=settings.jwt_refresh_days * 86400,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key=REFRESH_COOKIE, path="/")


def _issue_tokens(store: PlatformStore, user: User, response: Response) -> AuthResponse:
    settings = get_settings()
    refresh = store.issue_refresh_token(user.id, settings.jwt_refresh_days)
    _set_refresh_cookie(response, refresh)
    access = create_access_token(
        user.id, user.email, org_id=user.org_id, role=user.org_role
    )
    return AuthResponse(access_token=access, user=store.user_to_dict(user))


def build_auth_router() -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/register", response_model=AuthResponse)
    async def register(body: RegisterRequest, request: Request, response: Response) -> AuthResponse:
        store = _get_store(request)
        try:
            user = store.create_user(body.email, body.password, body.name)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        settings = get_settings()
        if settings.email_enabled:
            token = create_email_token(user.id, "verify")
            link = f"{settings.oauth_redirect_base_url.rstrip('/')}/verify-email?token={token}"
            await send_email(user.email, "Verify your GlobeCloud email", verification_email_html(link))
        return _issue_tokens(store, user, response)

    @router.post("/login", response_model=AuthResponse)
    async def login(body: LoginRequest, request: Request, response: Response) -> AuthResponse:
        store = _get_store(request)
        user = store.authenticate(body.email, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        return _issue_tokens(store, user, response)

    @router.post("/session", response_model=AuthResponse)
    async def establish_session(
        body: SessionRequest, request: Request, response: Response
    ) -> AuthResponse:
        """Exchange short-lived OAuth access token for session (no token in URL)."""
        from globe.auth.tokens import decode_access_token

        payload = decode_access_token(body.access_token)
        if not payload or not payload.get("sub"):
            raise HTTPException(status_code=401, detail="Invalid token")
        store = _get_store(request)
        user = store.get_user_by_id(payload["sub"])
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return _issue_tokens(store, user, response)

    @router.post("/refresh", response_model=AuthResponse)
    async def refresh(request: Request, response: Response) -> AuthResponse:
        store = _get_store(request)
        token = request.cookies.get(REFRESH_COOKIE)
        if not token:
            raise HTTPException(status_code=401, detail="No refresh token")
        user = store.validate_refresh_token(token)
        if not user:
            _clear_refresh_cookie(response)
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        store.revoke_refresh_token(token)
        return _issue_tokens(store, user, response)

    @router.post("/logout")
    async def logout(request: Request, response: Response) -> dict:
        store = _get_store(request)
        token = request.cookies.get(REFRESH_COOKIE)
        if token:
            store.revoke_refresh_token(token)
        _clear_refresh_cookie(response)
        return {"ok": True}

    @router.get("/me")
    async def me(request: Request) -> dict:
        from globe.api.auth import get_current_user

        user = await get_current_user(request)
        if not user:
            raise HTTPException(status_code=401, detail="Not authenticated")
        store = _get_store(request)
        db_user = store.get_user_by_id(user["id"])
        if not db_user:
            raise HTTPException(status_code=401, detail="User not found")
        return store.user_to_dict(db_user)

    @router.get("/oauth/{provider}")
    async def oauth_start(provider: str, request: Request) -> RedirectResponse:
        if provider == "google":
            return RedirectResponse(google_authorize_url(request), status_code=302)
        if provider == "github":
            return RedirectResponse(github_authorize_url(request), status_code=302)
        raise HTTPException(status_code=404, detail="Unknown provider")

    @router.get("/oauth/callback/{provider}")
    async def oauth_callback(
        provider: str,
        request: Request,
        code: Optional[str] = None,
        state: Optional[str] = None,
        error: Optional[str] = None,
    ) -> RedirectResponse:
        if error:
            raise HTTPException(status_code=400, detail=error)
        if not code:
            raise HTTPException(status_code=400, detail="Missing authorization code")
        _verify_state(request, state)
        settings = get_settings()
        store = _get_store(request)

        if provider == "google":
            provider_user_id, email, name = await exchange_google_code(request, code)
        elif provider == "github":
            provider_user_id, email, name = await exchange_github_code(request, code)
        else:
            raise HTTPException(status_code=404, detail="Unknown provider")

        if not provider_user_id:
            raise HTTPException(status_code=400, detail="OAuth profile missing user id")

        user = store.get_or_create_oauth_user(provider, provider_user_id, email, name)
        refresh = store.issue_refresh_token(user.id, settings.jwt_refresh_days)
        access = create_access_token(
            user.id, user.email, org_id=user.org_id, role=user.org_role
        )

        frontend = settings.oauth_redirect_base_url.rstrip("/")
        redirect = RedirectResponse(url=f"{frontend}/auth/callback", status_code=302)
        _set_refresh_cookie(redirect, refresh)
        redirect.set_cookie(
            key=ACCESS_COOKIE,
            value=access,
            httponly=True,
            secure=frontend.startswith("https"),
            samesite="lax",
            max_age=settings.jwt_access_minutes * 60,
            path="/",
        )
        return redirect

    @router.get("/oauth/complete", response_model=AuthResponse)
    async def oauth_complete(request: Request, response: Response) -> AuthResponse:
        """Complete OAuth after redirect — reads httpOnly cookies, returns access token."""
        store = _get_store(request)
        refresh = request.cookies.get(REFRESH_COOKIE)
        if not refresh:
            raise HTTPException(status_code=401, detail="No OAuth session")
        user = store.validate_refresh_token(refresh)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid OAuth session")
        return _issue_tokens(store, user, response)
    async def forgot_password(body: LoginRequest, request: Request) -> dict:
        store = _get_store(request)
        user = store.get_user_by_email(body.email)
        if user and user.has_password:
            settings = get_settings()
            token = create_email_token(user.id, "reset", hours=2)
            link = f"{settings.oauth_redirect_base_url.rstrip('/')}/reset-password?token={token}"
            await send_email(user.email, "Reset your GlobeCloud password", password_reset_html(link))
        return {"ok": True}

    return router


def _verify_state(request: Request, state: Optional[str]) -> None:
    expected = request.session.pop("oauth_state", None)
    if not expected or not state or expected != state:
        raise HTTPException(status_code=400, detail="Invalid OAuth state")
