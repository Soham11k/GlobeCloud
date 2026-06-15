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

    # Deployment: local | regional | gateway
    deployment_mode: str = "local"
    region_id: str = "us-east-1"
    peer_urls: str = ""
    gateway_peers: str = ""
    public_url: str = ""

    api_key: str = ""
    api_keys: str = ""
    replication_secret: str = ""
    cors_origins: str = "*"

    # Catalog seeding: SEED_DEMO_DATA=0 loads seed/catalog.json only (no parody SKUs)
    seed_demo_data: bool = False
    catalog_seed_file: str = "seed/catalog.json"

    @property
    def llm_enabled(self) -> bool:
        return bool(self.openai_api_key.strip())

    @property
    def auth_enabled(self) -> bool:
        return bool(self.api_key.strip() or self.api_keys.strip())

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
