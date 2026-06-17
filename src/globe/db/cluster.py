from __future__ import annotations

from pathlib import Path

from globe.database.models import REGIONS
from globe.database.peer import PeerClient
from globe.db.regional_database import RegionalPostgresDatabase


class PostgresCluster:
    """Multi-region Postgres cluster — mirrors DatabaseCluster interface."""

    def __init__(
        self,
        data_dir: Path | None = None,
        *,
        deployment_mode: str = "regional",
        region_id: str = "us-east-1",
        peer_urls: dict | None = None,
        api_key: str = "",
        replication_secret: str = "",
        seed_demo_data: bool = False,
        catalog_seed_file: str = "seed/catalog.json",
        organization_id: str = "default",
    ) -> None:
        self.data_dir = data_dir
        self.deployment_mode = deployment_mode
        self.local_region_id = region_id
        self.peer_urls = peer_urls or {}
        self.peers: dict[str, PeerClient] = {}
        self.organization_id = organization_id
        db_kwargs = {
            "seed_demo_data": seed_demo_data,
            "catalog_seed_file": catalog_seed_file,
            "organization_id": organization_id,
        }

        if self.deployment_mode == "regional":
            self.regions: dict[str, RegionalPostgresDatabase] = {
                region_id: RegionalPostgresDatabase(region_id, **db_kwargs)
            }
            for peer_id, url in self.peer_urls.items():
                self.peers[peer_id] = PeerClient(
                    peer_id,
                    url,
                    api_key=api_key,
                    replication_secret=replication_secret,
                )
        elif self.deployment_mode == "gateway":
            self.regions = {}
        else:
            self.regions = {
                cfg.id: RegionalPostgresDatabase(cfg.id, **db_kwargs) for cfg in REGIONS
            }

    def is_local(self, region_id: str) -> bool:
        return region_id in self.regions

    def get(self, region_id: str) -> RegionalPostgresDatabase:
        if region_id not in self.regions:
            raise KeyError(f"Unknown or remote region: {region_id}")
        return self.regions[region_id]

    def local_db(self) -> RegionalPostgresDatabase:
        return self.get(self.local_region_id)

    def region_ids(self) -> list[str]:
        if self.deployment_mode == "regional":
            return [self.local_region_id] + list(self.peers.keys())
        return list(self.regions.keys())

    async def get_products(self, region_id: str, organization_id: str | None = None) -> list[dict]:
        org = organization_id or self.organization_id
        if self.is_local(region_id):
            return self.get(region_id).list_products(org)
        peer = self.peers.get(region_id)
        if not peer:
            raise KeyError(f"Unknown region: {region_id}")
        return await peer.list_products()

    async def list_orders(
        self,
        region_id: str,
        *,
        limit: int = 50,
        since: str = "",
        organization_id: str | None = None,
    ) -> list[dict]:
        if not self.is_local(region_id):
            raise KeyError(f"Orders only available for local region: {region_id}")
        return self.get(region_id).list_orders(limit=limit, since=since, organization_id=organization_id)

    async def search_catalog(
        self,
        region_id: str,
        q: str = "",
        category: str = "",
        organization_id: str | None = None,
    ) -> list[dict]:
        org = organization_id or self.organization_id
        if self.is_local(region_id):
            return self.get(region_id).search_products(q, category, org)
        products = await self.get_products(region_id, org)
        if not q and not category:
            return products
        result = []
        for p in products:
            if category and p.get("category") != category:
                continue
            if q:
                blob = f"{p.get('name','')} {p.get('sku','')} {p.get('description','')}".lower()
                if q.lower() not in blob:
                    continue
            result.append(p)
        return result

    async def create_order(
        self,
        region_id: str,
        product_id: str,
        quantity: int,
        organization_id: str | None = None,
    ) -> dict:
        org = organization_id or self.organization_id
        if self.is_local(region_id):
            return self.get(region_id).create_order(product_id, quantity, org)
        peer = self.peers.get(region_id)
        if not peer:
            raise KeyError(f"Unknown region: {region_id}")
        return await peer.create_order(product_id, quantity)

    async def create_product(
        self,
        region_id: str,
        sku: str,
        name: str,
        price: float,
        stock: int,
        *,
        product_id: str | None = None,
        organization_id: str | None = None,
    ) -> dict:
        if not self.is_local(region_id):
            raise KeyError(f"Products can only be created in local region: {region_id}")
        return self.get(region_id).create_product(
            sku, name, price, stock, product_id=product_id, organization_id=organization_id
        )

    async def import_catalog(
        self,
        region_id: str,
        products: list[dict],
        knowledge: list[dict] | None = None,
        organization_id: str | None = None,
    ) -> dict:
        if not self.is_local(region_id):
            raise KeyError(f"Catalog import only allowed on local region: {region_id}")
        return self.get(region_id).import_catalog(products, knowledge, organization_id)

    async def get_knowledge(self, region_id: str, organization_id: str | None = None) -> list[dict]:
        org = organization_id or self.organization_id
        if self.is_local(region_id):
            return self.get(region_id).list_knowledge(org)
        peer = self.peers.get(region_id)
        if not peer:
            raise KeyError(f"Unknown region: {region_id}")
        return await peer.list_knowledge()

    async def all_knowledge(self, organization_id: str | None = None) -> list[dict]:
        org = organization_id or self.organization_id
        docs: list[dict] = []
        seen: set[str] = set()
        for region_id in self.region_ids():
            if self.is_local(region_id):
                source = self.get(region_id).list_knowledge(org)
            else:
                source = await self.peers[region_id].list_knowledge()
            for doc in source:
                if doc["id"] not in seen:
                    seen.add(doc["id"])
                    docs.append(doc)
        return docs

    def all_knowledge_sync(self, organization_id: str | None = None) -> list[dict]:
        org = organization_id or self.organization_id
        docs: list[dict] = []
        seen: set[str] = set()
        for db in self.regions.values():
            for doc in db.list_knowledge(org):
                if doc["id"] not in seen:
                    seen.add(doc["id"])
                    docs.append(doc)
        return docs
