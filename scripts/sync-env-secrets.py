#!/usr/bin/env python3
"""Fill missing secrets in .env without overwriting existing values."""
from __future__ import annotations

import json
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"

GENERATORS = {
    "JWT_SECRET": lambda: secrets.token_hex(32),
    "API_KEY": lambda: secrets.token_hex(32),
    "REPLICATION_SECRET": lambda: secrets.token_hex(32),
}

WEAK_DEFAULTS = {
    "REPLICATION_SECRET": frozenset({"dev-replication-secret", "change-me"}),
}

NATIVE_REGIONAL = {
    "REGIONAL_DATABASE_URL": "postgresql+psycopg://globe:globe@localhost:5432/globe_us",
}

STRIPE_WEBHOOK_URL = "https://globecloud.fly.dev/api/v1/billing/webhook"
STARTER_CENTS = 4900
PRO_CENTS = 19900


def parse_env(text: str) -> list[tuple[str, str]]:
    lines: list[tuple[str, str]] = []
    for raw in text.splitlines():
        if not raw.strip() or raw.lstrip().startswith("#"):
            lines.append(("", raw))
            continue
        if "=" not in raw:
            lines.append(("", raw))
            continue
        key, _, value = raw.partition("=")
        lines.append((key.strip(), value))
    return lines


def serialize_env(lines: list[tuple[str, str]]) -> str:
    out: list[str] = []
    for key, rest in lines:
        if key:
            out.append(f"{key}={rest}")
        else:
            out.append(rest)
    return "\n".join(out) + ("\n" if out else "")


def get_value(lines: list[tuple[str, str]], key: str) -> str | None:
    for k, v in lines:
        if k == key:
            return v
    return None


def set_value(lines: list[tuple[str, str]], key: str, value: str) -> None:
    for i, (k, _) in enumerate(lines):
        if k == key:
            lines[i] = (key, value)
            return
    lines.append((key, value))


def stripe_request(secret: str, method: str, path: str, data: dict | None = None) -> dict:
    url = f"https://api.stripe.com/v1{path}"
    body = urllib.parse.urlencode(data).encode() if data else None
    req = urllib.request.Request(url, data=body, method=method)
    import base64

    token = base64.b64encode(f"{secret}:".encode()).decode()
    req.add_header("Authorization", f"Basic {token}")
    if data:
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as exc:
        payload = exc.read().decode()
        try:
            err = json.loads(payload)
        except json.JSONDecodeError:
            err = {"error": {"message": payload}}
        return err


def fetch_stripe_config(secret: str) -> dict[str, str]:
    out: dict[str, str] = {}
    prices = stripe_request(secret, "GET", "/prices?active=true&limit=100&expand[]=data.product")
    if prices.get("error"):
        raise RuntimeError(prices["error"].get("message", "Stripe API error"))

    starter_id = ""
    pro_id = ""
    product_id = ""
    for price in prices.get("data", []):
        amount = price.get("unit_amount") or 0
        pid = price.get("id", "")
        meta = price.get("metadata") or {}
        plan = (meta.get("plan") or "").lower()
        product = price.get("product") or {}
        if isinstance(product, dict) and not product_id:
            product_id = product.get("id", "")
        if plan == "starter" or amount == STARTER_CENTS:
            starter_id = pid
        if plan == "pro" or amount == PRO_CENTS:
            pro_id = pid

    if product_id and not starter_id:
        created = stripe_request(
            secret,
            "POST",
            "/prices",
            {
                "unit_amount": str(STARTER_CENTS),
                "currency": "usd",
                "recurring[interval]": "month",
                "product": product_id,
                "nickname": "GlobeCloud Starter",
                "metadata[plan]": "starter",
            },
        )
        if created.get("id"):
            starter_id = created["id"]

    if product_id and not pro_id:
        created = stripe_request(
            secret,
            "POST",
            "/prices",
            {
                "unit_amount": str(PRO_CENTS),
                "currency": "usd",
                "recurring[interval]": "month",
                "product": product_id,
                "nickname": "GlobeCloud Pro",
                "metadata[plan]": "pro",
            },
        )
        if created.get("id"):
            pro_id = created["id"]

    if starter_id:
        out["STRIPE_PRICE_STARTER"] = starter_id
    if pro_id:
        out["STRIPE_PRICE_PRO"] = pro_id

    hooks = stripe_request(secret, "GET", "/webhook_endpoints?limit=20")
    whsec = ""
    for hook in hooks.get("data", []):
        if hook.get("url") == STRIPE_WEBHOOK_URL and hook.get("secret"):
            whsec = hook["secret"]
            break
    if not whsec:
        created = stripe_request(
            secret,
            "POST",
            "/webhook_endpoints",
            {
                "url": STRIPE_WEBHOOK_URL,
                "enabled_events[]": "checkout.session.completed",
                "enabled_events[]": "customer.subscription.updated",
                "enabled_events[]": "customer.subscription.deleted",
            },
        )
        if created.get("secret"):
            whsec = created["secret"]
    if whsec:
        out["STRIPE_WEBHOOK_SECRET"] = whsec

    return out


def main() -> int:
    fix_native = "--fix-native-db" in sys.argv
    set_production = "--production" in sys.argv
    fetch_stripe = "--fetch-stripe" in sys.argv or "--all" in sys.argv

    if not ENV_PATH.is_file():
        example = ROOT / ".env.example"
        if example.is_file():
            ENV_PATH.write_text(example.read_text())
            print(f"Created {ENV_PATH} from .env.example")
        else:
            print("No .env or .env.example found", file=sys.stderr)
            return 1

    lines = parse_env(ENV_PATH.read_text())
    changed: list[str] = []

    for key, gen in GENERATORS.items():
        current = get_value(lines, key)
        weak = key in WEAK_DEFAULTS and (current or "").strip() in WEAK_DEFAULTS[key]
        if current is None or not str(current).strip() or (set_production and weak):
            set_value(lines, key, gen())
            changed.append(key)

    if fix_native:
        regional = get_value(lines, "REGIONAL_DATABASE_URL") or ""
        if ":5433/" in regional or ":5434/" in regional or not regional.strip():
            set_value(lines, "REGIONAL_DATABASE_URL", NATIVE_REGIONAL["REGIONAL_DATABASE_URL"])
            changed.append("REGIONAL_DATABASE_URL (native :5432)")

    if set_production:
        if get_value(lines, "ENVIRONMENT") != "production":
            set_value(lines, "ENVIRONMENT", "production")
            changed.append("ENVIRONMENT=production")

    stripe_key = (get_value(lines, "STRIPE_SECRET_KEY") or "").strip()
    if fetch_stripe and stripe_key:
        try:
            stripe_vals = fetch_stripe_config(stripe_key)
            for key, value in stripe_vals.items():
                current = get_value(lines, key) or ""
                if not current.strip() or fetch_stripe:
                    set_value(lines, key, value)
                    changed.append(key)
        except Exception as exc:
            print(f"Stripe fetch failed: {exc}", file=sys.stderr)

    if changed:
        ENV_PATH.write_text(serialize_env(lines))
        print("Updated .env:")
        for item in changed:
            print(f"  • {item}")
    else:
        print(".env secrets already set — no changes")

    still_manual = [
        k
        for k in (
            "STRIPE_WEBHOOK_SECRET",
            "STRIPE_PRICE_STARTER",
            "STRIPE_PRICE_PRO",
            "GOOGLE_CLIENT_ID",
            "GOOGLE_CLIENT_SECRET",
            "GITHUB_CLIENT_ID",
            "GITHUB_CLIENT_SECRET",
            "SENTRY_DSN",
        )
        if not (get_value(lines, k) or "").strip()
    ]
    if still_manual:
        print("\nCannot auto-create (need dashboard setup):")
        for k in still_manual:
            print(f"  • {k}")
        if any(k.startswith("GOOGLE") or k.startswith("GITHUB") for k in still_manual):
            print("\n  OAuth: https://console.cloud.google.com/apis/credentials")
            print("         https://github.com/settings/developers")
            print("  Redirect: http://localhost:8000/auth/oauth/callback/google")
            print("            http://localhost:8000/auth/oauth/callback/github")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
