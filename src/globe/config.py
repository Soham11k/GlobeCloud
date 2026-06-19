from functools import lru_cache
from typing import Dict

from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_peer_urls(raw: str) -> Dict[str, str]:
    """Parse 'eu-west-1:https://host,ap-south-1:https://host' into a dict."""
    result: Dict[str, str] = {}
    for part in raw.split(","):
        part = part.strip()
        if not part or ":" not in part:
            continue
        region_id, url = part.split(":", 1)
        region_id = region_id.strip()
        url = url.strip().rstrip("/")
        if region_id and url:
            result[region_id] = url
    return result


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    product_name: str = "GlobeCloud"
    product_tagline: str = "Global database routing with grounded AI"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    openai_base_url: str = "https://api.openai.com/v1"

    host: str = "0.0.0.0"
    port: int = 8000
    data_dir: str = "data"

    # PostgreSQL data plane
    database_url: str = "postgresql+psycopg://globe:globe@localhost:5432/globe_platform"
    regional_database_url: str = ""
    environment: str = "development"  # development | staging | production

    # Redis (rate limits, sessions)
    redis_url: str = ""

    # Stripe billing
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_price_starter: str = ""
    stripe_price_pro: str = ""

    # Email (Resend)
    resend_api_key: str = ""
    email_from: str = "GlobeCloud <noreply@globecloud.io>"

    # Observability
    sentry_dsn: str = ""

    # Deployment: regional | gateway (local SQLite simulation removed)
    deployment_mode: str = "regional"
    region_id: str = "us-east-1"
    peer_urls: str = ""
    gateway_peers: str = ""
    public_url: str = ""

    api_key: str = ""
    api_keys: str = ""
    replication_secret: str = ""
    cors_origins: str = "*"

    # User authentication (JWT + OAuth)
    auth_required: bool = True
    jwt_secret: str = ""
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 30
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""
    oauth_redirect_base_url: str = "http://localhost:8000"

    # Catalog seeding: SEED_DEMO_DATA=0 loads seed/catalog.json only (no parody SKUs)
    seed_demo_data: bool = False
    catalog_seed_file: str = "seed/catalog.json"

    # Allow public GET on read-only /api/v1 routes in production (local demos / marketing)
    globe_public_read: bool = False

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() == "production"

    @property
    def is_development(self) -> bool:
        return self.environment.strip().lower() == "development"

    @property
    def regional_db_url(self) -> str:
        return self.regional_database_url.strip() or self.database_url

    @property
    def uses_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite") or self.regional_db_url.startswith("sqlite")

    @property
    def jwt_secret_key(self) -> str:
        if self.jwt_secret.strip():
            return self.jwt_secret.strip()
        if self.is_production:
            raise RuntimeError("JWT_SECRET is required in production")
        return "globecloud-dev-jwt-secret-change-in-production"

    @property
    def stripe_enabled(self) -> bool:
        return bool(self.stripe_secret_key.strip())

    @property
    def redis_enabled(self) -> bool:
        return bool(self.redis_url.strip())

    @property
    def sentry_enabled(self) -> bool:
        return bool(self.sentry_dsn.strip())

    @property
    def email_enabled(self) -> bool:
        return bool(self.resend_api_key.strip())

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key.strip())

    @property
    def llm_required(self) -> bool:
        return self.is_production and self.llm_enabled

    @property
    def api_auth_enabled(self) -> bool:
        return bool(self.api_key.strip() or self.api_keys.strip())

    @property
    def auth_enabled(self) -> bool:
        return self.user_auth_required or self.api_auth_enabled

    @property
    def user_auth_required(self) -> bool:
        return self.auth_required

    @property
    def oauth_providers(self) -> list:
        providers = []
        if self.google_client_id.strip() and self.google_client_secret.strip():
            providers.append("google")
        if self.github_client_id.strip() and self.github_client_secret.strip():
            providers.append("github")
        return providers

    @property
    def guest_read_enabled(self) -> bool:
        if self.globe_public_read:
            return True
        return not self.is_production and self.user_auth_required

    @property
    def valid_api_keys(self) -> set:
        keys = set()
        if self.api_key.strip():
            keys.add(self.api_key.strip())
        for part in self.api_keys.split(","):
            part = part.strip()
            if part:
                keys.add(part)
        return keys

    @property
    def replication_auth_enabled(self) -> bool:
        return bool(self.replication_secret.strip())

    @property
    def is_regional(self) -> bool:
        return self.deployment_mode.strip().lower() == "regional"

    @property
    def is_gateway(self) -> bool:
        return self.deployment_mode.strip().lower() == "gateway"

    @property
    def peers(self) -> Dict[str, str]:
        return parse_peer_urls(self.peer_urls)

    @property
    def gateway_peer_map(self) -> Dict[str, str]:
        return parse_peer_urls(self.gateway_peers)

    @property
    def cors_origin_list(self) -> list:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
