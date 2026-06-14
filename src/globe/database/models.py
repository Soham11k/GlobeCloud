from __future__ import annotations

import json
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

from globe.database.peer import PeerClient


def load_catalog_seed(path: Path) -> tuple[list[tuple], list[tuple]]:
    """Load products and knowledge from a JSON catalog file.

    Products: list of {id, sku, name, price, stock}
    Knowledge: list of {title, region, body}
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    products: list[tuple] = []
    for item in data.get("products", []):
        products.append(
            (
                item["id"],
                item["sku"],
                item["name"],
                float(item["price"]),
                int(item["stock"]),
            )
        )
    knowledge: list[tuple] = []
    for item in data.get("knowledge", []):
        knowledge.append((item["title"], item["region"], item["body"]))
    return products, knowledge


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class RegionConfig:
    id: str
    name: str
    latitude: float
    longitude: float
    base_latency_ms: float


REGIONS: tuple[RegionConfig, ...] = (
    RegionConfig("us-east-1", "US East (Virginia)", 37.43, -78.66, 12.0),
    RegionConfig("eu-west-1", "EU West (Ireland)", 53.35, -6.26, 18.0),
    RegionConfig("ap-south-1", "AP South (Mumbai)", 19.08, 72.88, 24.0),
)


SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    region TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS knowledge_docs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    region TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS replication_log (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    origin_region TEXT NOT NULL,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
    region TEXT NOT NULL,
    peer_region TEXT NOT NULL,
    last_seq INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (region, peer_region)
);
"""


SEED_PRODUCTS = (
    ("prod-001", "SKU-AWS-EC2", "Compute Node t3.large", 72.50, 120),
    ("prod-002", "SKU-GCP-GKE", "Kubernetes Autopilot Cluster", 95.00, 45),
    ("prod-003", "SKU-SS-DB", "SingleStore Cloud Node", 210.00, 18),
    ("prod-004", "SKU-MDB-AT", "MongoDB Atlas M30", 185.00, 22),
    ("prod-005", "SKU-LLM-GPU", "Inference GPU A10G Hour", 1.35, 5000),
)

SEED_KNOWLEDGE = (
    (
        "Global routing",
        "us-east-1",
        "Route users to the nearest healthy region using geo-DNS and latency probes. "
        "When a region fails health checks, traffic fails over within seconds while "
        "replication catches up on the write path.",
    ),
    (
        "Replication model",
        "eu-west-1",
        "This demo uses asynchronous multi-master replication with a conflict-last-write-wins "
        "policy. Each write is appended to a replication log and pulled by peer regions.",
    ),
    (
        "RAG grounding",
        "ap-south-1",
        "The agent retrieves cited knowledge snippets before answering. Answers without "
        "supporting documents are flagged as low confidence to reduce hallucination risk.",
    ),
    (
        "Inference optimization",
        "us-east-1",
        "Batch requests, cache KV states, and use smaller models for routing tasks. "
        "Reserve large models for complex reasoning only.",
    ),
)


class RegionalDatabase:
    def __init__(
        self,
        region_id: str,
        path: Path,
        *,
        seed_demo_data: bool = True,
        catalog_seed_file: str = "",
    ) -> None:
        self.region_id = region_id
        self.path = path
        self._seed_demo_data = seed_demo_data
        self._catalog_seed_file = catalog_seed_file
        self._lock = threading.RLock()
        path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(SCHEMA)
            if conn.execute("SELECT COUNT(*) FROM products").fetchone()[0] == 0:
                self._seed_catalog(conn)
            conn.commit()

    def _seed_catalog(self, conn: sqlite3.Connection) -> None:
        products: list[tuple] = []
        knowledge: list[tuple] = []

        if self._catalog_seed_file:
            seed_path = Path(self._catalog_seed_file)
            if seed_path.is_file():
                products, knowledge = load_catalog_seed(seed_path)
        elif self._seed_demo_data:
            products = list(SEED_PRODUCTS)
            knowledge = list(SEED_KNOWLEDGE)

        if not products and not knowledge:
            return

        now = utcnow()
        if products:
            conn.executemany(
                "INSERT INTO products VALUES (?, ?, ?, ?, ?, ?)",
                [(pid, sku, name, price, stock, now) for pid, sku, name, price, stock in products],
            )
        if knowledge:
            conn.executemany(
                "INSERT INTO knowledge_docs VALUES (?, ?, ?, ?, ?)",
                [
                    (str(uuid.uuid4()), title, body, doc_region, utcnow())
                    for title, doc_region, body in knowledge
                    if doc_region == self.region_id
                ],
            )

    @contextmanager
    def connection(self) -> Iterator[sqlite3.Connection]:
        with self._lock:
            conn = self._connect()
            try:
                yield conn
                conn.commit()
            finally:
                conn.close()

    def list_products(self) -> list[dict]:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT id, sku, name, price, stock, updated_at FROM products ORDER BY name"
            ).fetchall()
        return [dict(row) for row in rows]

    def get_product(self, product_id: str) -> dict | None:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT id, sku, name, price, stock, updated_at FROM products WHERE id = ?",
                (product_id,),
            ).fetchone()
        return dict(row) if row else None

    def create_product(
        self,
        sku: str,
        name: str,
        price: float,
        stock: int,
        *,
        product_id: str | None = None,
    ) -> dict:
        pid = product_id or str(uuid.uuid4())
        now = utcnow()
        with self.connection() as conn:
            existing = conn.execute(
                "SELECT id FROM products WHERE id = ?", (pid,)
            ).fetchone()
            if existing:
                raise ValueError(f"Product already exists: {pid}")
            conn.execute(
                "INSERT INTO products VALUES (?, ?, ?, ?, ?, ?)",
                (pid, sku, name, price, stock, now),
            )
            self._append_replication(
                conn,
                table_name="products",
                row_id=pid,
                operation="INSERT",
                payload={
                    "sku": sku,
                    "name": name,
                    "price": price,
                    "stock": stock,
                    "updated_at": now,
                },
            )
        return {
            "id": pid,
            "sku": sku,
            "name": name,
            "price": price,
            "stock": stock,
            "updated_at": now,
        }

    def import_catalog(
        self,
        products: list[dict],
        knowledge: list[dict] | None = None,
    ) -> dict:
        created_products: list[dict] = []
        created_docs: list[dict] = []
        for item in products:
            created_products.append(
                self.create_product(
                    item["sku"],
                    item["name"],
                    float(item["price"]),
                    int(item["stock"]),
                    product_id=item.get("id"),
                )
            )
        for item in knowledge or []:
            if item.get("region", self.region_id) != self.region_id:
                continue
            created_docs.append(self.append_knowledge(item["title"], item["body"]))
        return {"products": created_products, "knowledge": created_docs}

    def create_order(self, product_id: str, quantity: int) -> dict:
        order_id = str(uuid.uuid4())
        now = utcnow()
        with self.connection() as conn:
            product = conn.execute(
                "SELECT stock FROM products WHERE id = ?", (product_id,)
            ).fetchone()
            if not product:
                raise ValueError(f"Unknown product: {product_id}")
            if product["stock"] < quantity:
                raise ValueError("Insufficient stock in this region")
            conn.execute(
                "UPDATE products SET stock = stock - ?, updated_at = ? WHERE id = ?",
                (quantity, now, product_id),
            )
            conn.execute(
                "INSERT INTO orders VALUES (?, ?, ?, ?, ?)",
                (order_id, product_id, quantity, self.region_id, now),
            )
            self._append_replication(
                conn,
                table_name="products",
                row_id=product_id,
                operation="UPDATE",
                payload={"stock_delta": -quantity, "updated_at": now},
            )
            self._append_replication(
                conn,
                table_name="orders",
                row_id=order_id,
                operation="INSERT",
                payload={
                    "product_id": product_id,
                    "quantity": quantity,
                    "region": self.region_id,
                    "created_at": now,
                },
            )
        return {
            "id": order_id,
            "product_id": product_id,
            "quantity": quantity,
            "region": self.region_id,
            "created_at": now,
        }

    def list_knowledge(self) -> list[dict]:
        with self.connection() as conn:
            rows = conn.execute(
                "SELECT id, title, body, region, updated_at FROM knowledge_docs ORDER BY title"
            ).fetchall()
        return [dict(row) for row in rows]

    def append_knowledge(self, title: str, body: str) -> dict:
        doc_id = str(uuid.uuid4())
        now = utcnow()
        with self.connection() as conn:
            conn.execute(
                "INSERT INTO knowledge_docs VALUES (?, ?, ?, ?, ?)",
                (doc_id, title, body, self.region_id, now),
            )
            self._append_replication(
                conn,
                table_name="knowledge_docs",
                row_id=doc_id,
                operation="INSERT",
                payload={
                    "title": title,
                    "body": body,
                    "region": self.region_id,
                    "updated_at": now,
                },
            )
        return {
            "id": doc_id,
            "title": title,
            "body": body,
            "region": self.region_id,
            "updated_at": now,
        }

    def stats(self) -> dict:
        with self.connection() as conn:
            products = conn.execute("SELECT COUNT(*) FROM products").fetchone()[0]
            orders = conn.execute("SELECT COUNT(*) FROM orders").fetchone()[0]
            docs = conn.execute("SELECT COUNT(*) FROM knowledge_docs").fetchone()[0]
            last_seq = conn.execute(
                "SELECT COALESCE(MAX(seq), 0) FROM replication_log"
            ).fetchone()[0]
        return {
            "region": self.region_id,
            "products": products,
            "orders": orders,
            "knowledge_docs": docs,
            "replication_log_entries": last_seq,
        }

    def _append_replication(
        self,
        conn: sqlite3.Connection,
        *,
        table_name: str,
        row_id: str,
        operation: str,
        payload: dict,
    ) -> None:
        import json

        conn.execute(
            """
            INSERT INTO replication_log
                (origin_region, table_name, row_id, operation, payload, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                self.region_id,
                table_name,
                row_id,
                operation,
                json.dumps(payload),
                utcnow(),
            ),
        )

    def replication_entries_since(self, seq: int) -> list[dict]:
        import json

        with self.connection() as conn:
            rows = conn.execute(
                """
                SELECT seq, origin_region, table_name, row_id, operation, payload, created_at
                FROM replication_log
                WHERE seq > ?
                ORDER BY seq
                """,
                (seq,),
            ).fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["payload"] = json.loads(item["payload"])
            result.append(item)
        return result

    def apply_replication_entry(self, entry: dict) -> None:
        import json

        payload = entry["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)

        with self.connection() as conn:
            if entry["table_name"] == "products" and entry["operation"] == "INSERT":
                conn.execute(
                    """
                    INSERT OR IGNORE INTO products
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        entry["row_id"],
                        payload["sku"],
                        payload["name"],
                        payload["price"],
                        payload["stock"],
                        payload["updated_at"],
                    ),
                )
            elif entry["table_name"] == "products" and entry["operation"] == "UPDATE":
                delta = payload["stock_delta"]
                conn.execute(
                    """
                    UPDATE products
                    SET stock = CASE WHEN stock + ? < 0 THEN 0 ELSE stock + ? END,
                        updated_at = ?
                    WHERE id = ?
                    """,
                    (delta, delta, payload["updated_at"], entry["row_id"]),
                )
            elif entry["table_name"] == "orders" and entry["operation"] == "INSERT":
                conn.execute(
                    """
                    INSERT OR IGNORE INTO orders
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        entry["row_id"],
                        payload["product_id"],
                        payload["quantity"],
                        payload["region"],
                        payload["created_at"],
                    ),
                )
            elif entry["table_name"] == "knowledge_docs" and entry["operation"] == "INSERT":
                conn.execute(
                    """
                    INSERT OR IGNORE INTO knowledge_docs
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        entry["row_id"],
                        payload["title"],
                        payload["body"],
                        payload["region"],
                        payload["updated_at"],
                    ),
                )

            conn.execute(
                """
                INSERT INTO sync_state (region, peer_region, last_seq)
                VALUES (?, ?, ?)
                ON CONFLICT(region, peer_region) DO UPDATE SET last_seq = excluded.last_seq
                """,
                (self.region_id, entry["origin_region"], entry["seq"]),
            )

    def update_sync_cursor(self, peer_region: str, last_seq: int) -> None:
        with self.connection() as conn:
            conn.execute(
                """
                INSERT INTO sync_state (region, peer_region, last_seq)
                VALUES (?, ?, ?)
                ON CONFLICT(region, peer_region) DO UPDATE SET last_seq = excluded.last_seq
                """,
                (self.region_id, peer_region, last_seq),
            )

    def get_sync_cursor(self, peer_region: str) -> int:
        with self.connection() as conn:
            row = conn.execute(
                "SELECT last_seq FROM sync_state WHERE region = ? AND peer_region = ?",
                (self.region_id, peer_region),
            ).fetchone()
        return row["last_seq"] if row else 0

    def sync_lag(self) -> list[dict]:
        with self.connection() as conn:
            local_seq = conn.execute(
                "SELECT COALESCE(MAX(seq), 0) FROM replication_log"
            ).fetchone()[0]
            rows = conn.execute(
                "SELECT peer_region, last_seq FROM sync_state"
            ).fetchall()
        lag = []
        for row in rows:
            lag.append(
                {
                    "peer_region": row["peer_region"],
                    "last_applied_seq": row["last_seq"],
                    "local_head_seq": local_seq,
                    "behind_by": max(local_seq - row["last_seq"], 0),
                }
            )
        return lag


class DatabaseCluster:
    def __init__(
        self,
        data_dir: Path,
        *,
        deployment_mode: str = "local",
        region_id: str = "us-east-1",
        peer_urls: dict | None = None,
        api_key: str = "",
        replication_secret: str = "",
        seed_demo_data: bool = True,
        catalog_seed_file: str = "",
    ) -> None:
        self.data_dir = data_dir
        self.deployment_mode = deployment_mode
        self.local_region_id = region_id
        self.peer_urls = peer_urls or {}
        self.peers: dict[str, PeerClient] = {}
        db_kwargs = {
            "seed_demo_data": seed_demo_data,
            "catalog_seed_file": catalog_seed_file,
        }

        if self.deployment_mode == "regional":
            self.regions: dict[str, RegionalDatabase] = {
                region_id: RegionalDatabase(
                    region_id, data_dir / f"{region_id}.sqlite", **db_kwargs
                )
            }
            for peer_id, url in self.peer_urls.items():
                self.peers[peer_id] = PeerClient(
                    peer_id,
                    url,
                    api_key=api_key,
                    replication_secret=replication_secret,
                )
        else:
            self.regions = {
                cfg.id: RegionalDatabase(cfg.id, data_dir / f"{cfg.id}.sqlite", **db_kwargs)
                for cfg in REGIONS
            }

    def is_local(self, region_id: str) -> bool:
        return region_id in self.regions

    def get(self, region_id: str) -> RegionalDatabase:
        if region_id not in self.regions:
            raise KeyError(f"Unknown or remote region: {region_id}")
        return self.regions[region_id]

    def local_db(self) -> RegionalDatabase:
        return self.get(self.local_region_id)

    def region_ids(self) -> list[str]:
        if self.deployment_mode == "regional":
            return [self.local_region_id] + list(self.peers.keys())
        return list(self.regions.keys())

    async def get_products(self, region_id: str) -> list[dict]:
        if self.is_local(region_id):
            return self.get(region_id).list_products()
        peer = self.peers.get(region_id)
        if not peer:
            raise KeyError(f"Unknown region: {region_id}")
        return await peer.list_products()

    async def create_order(self, region_id: str, product_id: str, quantity: int) -> dict:
        if self.is_local(region_id):
            return self.get(region_id).create_order(product_id, quantity)
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
    ) -> dict:
        if not self.is_local(region_id):
            raise KeyError(f"Products can only be created in local region: {region_id}")
        return self.get(region_id).create_product(
            sku, name, price, stock, product_id=product_id
        )

    async def import_catalog(
        self,
        region_id: str,
        products: list[dict],
        knowledge: list[dict] | None = None,
    ) -> dict:
        if not self.is_local(region_id):
            raise KeyError(f"Catalog import only allowed on local region: {region_id}")
        return self.get(region_id).import_catalog(products, knowledge)

    async def get_knowledge(self, region_id: str) -> list[dict]:
        if self.is_local(region_id):
            return self.get(region_id).list_knowledge()
        peer = self.peers.get(region_id)
        if not peer:
            raise KeyError(f"Unknown region: {region_id}")
        return await peer.list_knowledge()

    async def all_knowledge(self) -> list[dict]:
        docs: list[dict] = []
        seen: set[str] = set()
        for region_id in self.region_ids():
            if self.is_local(region_id):
                source = self.get(region_id).list_knowledge()
            else:
                source = await self.peers[region_id].list_knowledge()
            for doc in source:
                if doc["id"] not in seen:
                    seen.add(doc["id"])
                    docs.append(doc)
        return docs

    def all_knowledge_sync(self) -> list[dict]:
        """Synchronous knowledge aggregation for local mode only."""
        docs: list[dict] = []
        seen: set[str] = set()
        for db in self.regions.values():
            for doc in db.list_knowledge():
                if doc["id"] not in seen:
                    seen.add(doc["id"])
                    docs.append(doc)
        return docs
