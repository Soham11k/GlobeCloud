from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from globe.auth.passwords import hash_password, verify_password
from globe.auth.tokens import hash_token, new_refresh_token, new_user_id

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT NOT NULL DEFAULT '',
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_user_id TEXT NOT NULL,
    email TEXT,
    name TEXT,
    UNIQUE(provider, provider_user_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    revoked_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_api_keys (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    key_hash TEXT NOT NULL,
    label TEXT NOT NULL DEFAULT 'default',
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
);
"""


@dataclass
class User:
    id: str
    email: str
    name: str
    email_verified: bool
    created_at: str
    has_password: bool


class AuthStore:
    def __init__(self, data_dir: Path) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        self.path = data_dir / "auth.db"
        self._conn = sqlite3.connect(self.path, check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.executescript(SCHEMA)
        self._conn.commit()

    def _row_to_user(self, row: sqlite3.Row) -> User:
        return User(
            id=row["id"],
            email=row["email"],
            name=row["name"] or "",
            email_verified=bool(row["email_verified"]),
            created_at=row["created_at"],
            has_password=bool(row["password_hash"]),
        )

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        row = self._conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return self._row_to_user(row) if row else None

    def get_user_by_email(self, email: str) -> Optional[User]:
        row = self._conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
        return self._row_to_user(row) if row else None

    def create_user(self, email: str, password: str, name: str = "") -> User:
        email = email.strip().lower()
        if self.get_user_by_email(email):
            raise ValueError("Email already registered")
        user_id = new_user_id()
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            "INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, email, hash_password(password), name.strip(), now),
        )
        self._conn.commit()
        return self.get_user_by_id(user_id)  # type: ignore[return-value]

    def authenticate(self, email: str, password: str) -> Optional[User]:
        row = self._conn.execute(
            "SELECT * FROM users WHERE email = ?",
            (email.strip().lower(),),
        ).fetchone()
        if not row or not row["password_hash"]:
            return None
        if not verify_password(password, row["password_hash"]):
            return None
        return self._row_to_user(row)

    def issue_refresh_token(self, user_id: str, days: int) -> str:
        token = new_refresh_token()
        token_id = new_user_id()
        expires = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()
        self._conn.execute(
            "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
            (token_id, user_id, hash_token(token), expires),
        )
        self._conn.commit()
        return token

    def validate_refresh_token(self, token: str) -> Optional[User]:
        row = self._conn.execute(
            """
            SELECT rt.*, u.email, u.name, u.email_verified, u.created_at, u.password_hash
            FROM refresh_tokens rt
            JOIN users u ON u.id = rt.user_id
            WHERE rt.token_hash = ? AND rt.revoked_at IS NULL
            """,
            (hash_token(token),),
        ).fetchone()
        if not row:
            return None
        expires = datetime.fromisoformat(row["expires_at"])
        if expires < datetime.now(timezone.utc):
            return None
        return User(
            id=row["user_id"],
            email=row["email"],
            name=row["name"] or "",
            email_verified=bool(row["email_verified"]),
            created_at=row["created_at"],
            has_password=bool(row["password_hash"]),
        )

    def revoke_refresh_token(self, token: str) -> None:
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            "UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?",
            (now, hash_token(token)),
        )
        self._conn.commit()

    def get_or_create_oauth_user(
        self,
        provider: str,
        provider_user_id: str,
        email: str,
        name: str,
    ) -> User:
        row = self._conn.execute(
            "SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_user_id = ?",
            (provider, provider_user_id),
        ).fetchone()
        if row:
            user = self.get_user_by_id(row["user_id"])
            if user:
                return user

        email = email.strip().lower()
        existing = self.get_user_by_email(email) if email else None
        if existing:
            user_id = existing.id
        else:
            user_id = new_user_id()
            now = datetime.now(timezone.utc).isoformat()
            self._conn.execute(
                "INSERT INTO users (id, email, password_hash, name, email_verified, created_at) VALUES (?, ?, NULL, ?, 1, ?)",
                (user_id, email or f"{provider}_{provider_user_id}@oauth.local", name, now),
            )

        self._conn.execute(
            """
            INSERT OR REPLACE INTO oauth_accounts (user_id, provider, provider_user_id, email, name)
            VALUES (?, ?, ?, ?, ?)
            """,
            (user_id, provider, provider_user_id, email, name),
        )
        self._conn.commit()
        return self.get_user_by_id(user_id)  # type: ignore[return-value]

    def user_to_dict(self, user: User) -> dict:
        return {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "email_verified": user.email_verified,
            "has_password": user.has_password,
        }
