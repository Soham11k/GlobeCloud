from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from globe.database.models import load_catalog_seed, resolve_catalog_path
from globe.db.engine import get_regional_session
from globe.db.regional_models import (
    KnowledgeDocument,
    Order,
    Product,
    ReplicationCursor,
    ReplicationOutbox,
)


def utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _utcnow_dt() -> datetime:
    return datetime.now(timezone.utc)


class RegionalPostgresDatabase:
    """Postgres regional data plane with transactional outbox replication."""

    def __init__(
        self,
        region_id: str,
        *,
        organization_id: str = "default",
        seed_demo_data: bool = False,
        catalog_seed_file: str = "",
    ) -> None:
        self.region_id = region_id
        self.organization_id = organization_id
        self._seed_demo_data = seed_demo_data
        self._catalog_seed_file = catalog_seed_file
        self._lock = threading.RLock()
        self._initialized = False

    def bootstrap(self) -> None:
        if self._initialized:
            return
        self._init_db()
        self._initialized = True

    def _init_db(self) -> None:
        with self._lock, get_regional_session() as session:
            count = session.scalar(
                select(func.count()).select_from(Product).where(
                    Product.organization_id == self.organization_id
                )
            )
            if count == 0:
                self._seed_catalog(session)

    def _seed_catalog(self, session: Session) -> None:
        products: list[dict] = []
        knowledge: list[tuple] = []
        if self._catalog_seed_file:
            seed_path = resolve_catalog_path(self._catalog_seed_file)
            if seed_path is not None:
                products, knowledge = load_catalog_seed(seed_path)
        if not products and not knowledge:
            return
        now = _utcnow_dt()
        for p in products:
            session.add(
                Product(
                    id=p["id"],
                    organization_id=self.organization_id,
                    sku=p["sku"],
                    name=p["name"],
                    price=float(p["price"]),
                    stock=int(p["stock"]),
                    description=p.get("description", ""),
                    category=p.get("category", "general"),
                    image_url=p.get("image_url", ""),
                    updated_at=now,
                )
            )
        for title, doc_region, body in knowledge:
            if doc_region != self.region_id:
                continue
            session.add(
                KnowledgeDocument(
                    id=str(uuid.uuid4()),
                    organization_id=self.organization_id,
                    title=title,
                    body=body,
                    region=self.region_id,
                    updated_at=now,
                )
            )

    def _session_ready(self) -> None:
        if not self._initialized:
            self.bootstrap()

    def list_products(self, organization_id: str | None = None) -> list[dict]:
        self._session_ready()
        org = organization_id or self.organization_id
        with get_regional_session() as session:
            rows = session.scalars(
                select(Product)
                .where(Product.organization_id == org)
                .order_by(Product.name)
            ).all()
            return [self._product_dict(r) for r in rows]

    def _product_dict(self, row: Product) -> dict:
        return {
            "id": row.id,
            "sku": row.sku,
            "name": row.name,
            "price": row.price,
            "stock": row.stock,
            "updated_at": row.updated_at.isoformat() if row.updated_at else utcnow(),
            "description": row.description,
            "category": row.category,
            "image_url": row.image_url,
        }

    def search_products(
        self, q: str = "", category: str = "", organization_id: str | None = None
    ) -> list[dict]:
        org = organization_id or self.organization_id
        with get_regional_session() as session:
            stmt = select(Product).where(Product.organization_id == org)
            if category:
                stmt = stmt.where(Product.category == category)
            rows = session.scalars(stmt.order_by(Product.name)).all()
            products = [self._product_dict(r) for r in rows]
        if not q:
            return products
        ql = q.lower()
        return [
            p
            for p in products
            if ql in p["name"].lower()
            or ql in p["sku"].lower()
            or ql in p.get("description", "").lower()
        ]

    def list_orders(
        self, limit: int = 50, since: str = "", organization_id: str | None = None
    ) -> list[dict]:
        org = organization_id or self.organization_id
        with get_regional_session() as session:
            stmt = (
                select(Order, Product)
                .join(Product, Product.id == Order.product_id, isouter=True)
                .where(Order.region == self.region_id, Order.organization_id == org)
            )
            if since:
                stmt = stmt.where(Order.created_at >= datetime.fromisoformat(since))
            stmt = stmt.order_by(Order.created_at.desc()).limit(limit)
            rows = session.execute(stmt).all()
            result = []
            for order, product in rows:
                result.append(
                    {
                        "id": order.id,
                        "product_id": order.product_id,
                        "quantity": order.quantity,
                        "region": order.region,
                        "created_at": order.created_at.isoformat() if order.created_at else utcnow(),
                        "product_name": product.name if product else "",
                        "sku": product.sku if product else "",
                    }
                )
            return result

    def get_product(self, product_id: str, organization_id: str | None = None) -> dict | None:
        org = organization_id or self.organization_id
        with get_regional_session() as session:
            row = session.scalar(
                select(Product).where(Product.id == product_id, Product.organization_id == org)
            )
            return self._product_dict(row) if row else None

    def create_product(
        self,
        sku: str,
        name: str,
        price: float,
        stock: int,
        *,
        product_id: str | None = None,
        description: str = "",
        category: str = "general",
        image_url: str = "",
        organization_id: str | None = None,
    ) -> dict:
        org = organization_id or self.organization_id
        pid = product_id or str(uuid.uuid4())
        now = _utcnow_dt()
        with self._lock, get_regional_session() as session:
            existing = session.scalar(select(Product).where(Product.id == pid))
            if existing:
                raise ValueError(f"Product already exists: {pid}")
            product = Product(
                id=pid,
                organization_id=org,
                sku=sku,
                name=name,
                price=price,
                stock=stock,
                description=description,
                category=category,
                image_url=image_url,
                updated_at=now,
            )
            session.add(product)
            self._append_replication(
                session,
                table_name="products",
                row_id=pid,
                operation="INSERT",
                payload={
                    "organization_id": org,
                    "sku": sku,
                    "name": name,
                    "price": price,
                    "stock": stock,
                    "updated_at": now.isoformat(),
                    "description": description,
                    "category": category,
                    "image_url": image_url,
                },
            )
            return self._product_dict(product)

    def import_catalog(
        self,
        products: list[dict],
        knowledge: list[dict] | None = None,
        organization_id: str | None = None,
    ) -> dict:
        created_products = [
            self.create_product(
                item["sku"],
                item["name"],
                float(item["price"]),
                int(item["stock"]),
                product_id=item.get("id"),
                description=item.get("description", ""),
                category=item.get("category", "general"),
                image_url=item.get("image_url", ""),
                organization_id=organization_id,
            )
            for item in products
        ]
        created_docs = []
        for item in knowledge or []:
            if item.get("region", self.region_id) != self.region_id:
                continue
            created_docs.append(self.append_knowledge(item["title"], item["body"], organization_id))
        return {"products": created_products, "knowledge": created_docs}

    def create_order(
        self, product_id: str, quantity: int, organization_id: str | None = None
    ) -> dict:
        org = organization_id or self.organization_id
        order_id = str(uuid.uuid4())
        now = _utcnow_dt()
        with self._lock, get_regional_session() as session:
            product = session.scalar(
                select(Product).where(Product.id == product_id, Product.organization_id == org)
            )
            if not product:
                raise ValueError(f"Unknown product: {product_id}")
            if product.stock < quantity:
                raise ValueError("Insufficient stock in this region")
            product.stock -= quantity
            product.updated_at = now
            order = Order(
                id=order_id,
                organization_id=org,
                product_id=product_id,
                quantity=quantity,
                region=self.region_id,
                created_at=now,
            )
            session.add(order)
            self._append_replication(
                session,
                table_name="products",
                row_id=product_id,
                operation="UPDATE",
                payload={"stock_delta": -quantity, "updated_at": now.isoformat()},
            )
            self._append_replication(
                session,
                table_name="orders",
                row_id=order_id,
                operation="INSERT",
                payload={
                    "organization_id": org,
                    "product_id": product_id,
                    "quantity": quantity,
                    "region": self.region_id,
                    "created_at": now.isoformat(),
                },
            )
        return {
            "id": order_id,
            "product_id": product_id,
            "quantity": quantity,
            "region": self.region_id,
            "created_at": now.isoformat(),
        }

    def list_knowledge(self, organization_id: str | None = None) -> list[dict]:
        org = organization_id or self.organization_id
        with get_regional_session() as session:
            rows = session.scalars(
                select(KnowledgeDocument)
                .where(KnowledgeDocument.organization_id == org)
                .order_by(KnowledgeDocument.title)
            ).all()
            return [self._knowledge_dict(r) for r in rows]

    def _knowledge_dict(self, row: KnowledgeDocument) -> dict:
        return {
            "id": row.id,
            "title": row.title,
            "body": row.body,
            "region": row.region,
            "updated_at": row.updated_at.isoformat() if row.updated_at else utcnow(),
        }

    def append_knowledge(
        self, title: str, body: str, organization_id: str | None = None, embedding=None
    ) -> dict:
        org = organization_id or self.organization_id
        doc_id = str(uuid.uuid4())
        now = _utcnow_dt()
        with self._lock, get_regional_session() as session:
            doc = KnowledgeDocument(
                id=doc_id,
                organization_id=org,
                title=title,
                body=body,
                region=self.region_id,
                updated_at=now,
                embedding=embedding,
            )
            session.add(doc)
            self._append_replication(
                session,
                table_name="knowledge_documents",
                row_id=doc_id,
                operation="INSERT",
                payload={
                    "organization_id": org,
                    "title": title,
                    "body": body,
                    "region": self.region_id,
                    "updated_at": now.isoformat(),
                },
            )
            return self._knowledge_dict(doc)

    def update_embedding(self, doc_id: str, embedding: list[float]) -> None:
        with get_regional_session() as session:
            doc = session.get(KnowledgeDocument, doc_id)
            if doc:
                doc.embedding = embedding

    def search_knowledge_vector(
        self,
        query_embedding: list[float],
        *,
        top_k: int = 3,
        organization_id: str | None = None,
        region: str | None = None,
    ) -> list[dict]:
        org = organization_id or self.organization_id
        with get_regional_session() as session:
            embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"
            sql = """
                SELECT id, title, body, region, updated_at,
                       1 - (embedding <=> CAST(:vec AS vector)) AS score
                FROM knowledge_documents
                WHERE organization_id = :org AND embedding IS NOT NULL
            """
            params: dict = {"vec": embedding_str, "org": org}
            if region:
                sql += " AND region = :region"
                params["region"] = region
            sql += " ORDER BY embedding <=> CAST(:vec AS vector) LIMIT :limit"
            params["limit"] = top_k
            try:
                rows = session.execute(text(sql), params).mappings().all()
            except Exception:
                return []
        return [
            {
                "id": r["id"],
                "title": r["title"],
                "body": r["body"],
                "region": r["region"],
                "updated_at": r["updated_at"].isoformat() if r["updated_at"] else utcnow(),
                "score": float(r["score"]),
            }
            for r in rows
        ]

    def stats(self) -> dict:
        with get_regional_session() as session:
            products = session.scalar(select(func.count()).select_from(Product)) or 0
            orders = session.scalar(
                select(func.count()).select_from(Order).where(Order.region == self.region_id)
            ) or 0
            docs = session.scalar(select(func.count()).select_from(KnowledgeDocument)) or 0
            last_seq = session.scalar(select(func.max(ReplicationOutbox.seq))) or 0
        return {
            "region": self.region_id,
            "products": products,
            "orders": orders,
            "knowledge_docs": docs,
            "replication_log_entries": last_seq,
        }

    def _append_replication(
        self,
        session: Session,
        *,
        table_name: str,
        row_id: str,
        operation: str,
        payload: dict,
    ) -> None:
        session.add(
            ReplicationOutbox(
                origin_region=self.region_id,
                table_name=table_name,
                row_id=row_id,
                operation=operation,
                payload=json.dumps(payload),
                created_at=_utcnow_dt(),
            )
        )

    def replication_entries_since(self, seq: int) -> list[dict]:
        with get_regional_session() as session:
            rows = session.scalars(
                select(ReplicationOutbox)
                .where(ReplicationOutbox.seq > seq)
                .order_by(ReplicationOutbox.seq)
            ).all()
            result = []
            for row in rows:
                result.append(
                    {
                        "seq": row.seq,
                        "origin_region": row.origin_region,
                        "table_name": row.table_name,
                        "row_id": row.row_id,
                        "operation": row.operation,
                        "payload": json.loads(row.payload),
                        "created_at": row.created_at.isoformat() if row.created_at else utcnow(),
                    }
                )
            return result

    def apply_replication_entry(self, entry: dict) -> None:
        payload = entry["payload"]
        if isinstance(payload, str):
            payload = json.loads(payload)
        org = payload.get("organization_id", self.organization_id)

        with self._lock, get_regional_session() as session:
            if entry["table_name"] == "products" and entry["operation"] == "INSERT":
                existing = session.get(Product, entry["row_id"])
                if existing is None:
                    session.add(
                        Product(
                            id=entry["row_id"],
                            organization_id=org,
                            sku=payload["sku"],
                            name=payload["name"],
                            price=payload["price"],
                            stock=payload["stock"],
                            updated_at=datetime.fromisoformat(payload["updated_at"]),
                            description=payload.get("description", ""),
                            category=payload.get("category", "general"),
                            image_url=payload.get("image_url", ""),
                        )
                    )
            elif entry["table_name"] == "products" and entry["operation"] == "UPDATE":
                product = session.get(Product, entry["row_id"])
                if product:
                    delta = payload["stock_delta"]
                    product.stock = max(product.stock + delta, 0)
                    product.updated_at = datetime.fromisoformat(payload["updated_at"])
            elif entry["table_name"] == "orders" and entry["operation"] == "INSERT":
                if session.get(Order, entry["row_id"]) is None:
                    session.add(
                        Order(
                            id=entry["row_id"],
                            organization_id=org,
                            product_id=payload["product_id"],
                            quantity=payload["quantity"],
                            region=payload["region"],
                            created_at=datetime.fromisoformat(payload["created_at"]),
                        )
                    )
            elif entry["table_name"] in ("knowledge_docs", "knowledge_documents") and entry["operation"] == "INSERT":
                if session.get(KnowledgeDocument, entry["row_id"]) is None:
                    session.add(
                        KnowledgeDocument(
                            id=entry["row_id"],
                            organization_id=org,
                            title=payload["title"],
                            body=payload["body"],
                            region=payload["region"],
                            updated_at=datetime.fromisoformat(payload["updated_at"]),
                        )
                    )

            self._update_sync_cursor(session, entry["origin_region"], entry["seq"])

    def _update_sync_cursor(self, session: Session, peer_region: str, last_seq: int) -> None:
        cursor = session.scalar(
            select(ReplicationCursor).where(
                ReplicationCursor.region == self.region_id,
                ReplicationCursor.peer_region == peer_region,
            )
        )
        if cursor:
            cursor.last_seq = last_seq
        else:
            session.add(
                ReplicationCursor(
                    region=self.region_id,
                    peer_region=peer_region,
                    last_seq=last_seq,
                )
            )

    def update_sync_cursor(self, peer_region: str, last_seq: int) -> None:
        with get_regional_session() as session:
            self._update_sync_cursor(session, peer_region, last_seq)

    def get_sync_cursor(self, peer_region: str) -> int:
        with get_regional_session() as session:
            cursor = session.scalar(
                select(ReplicationCursor).where(
                    ReplicationCursor.region == self.region_id,
                    ReplicationCursor.peer_region == peer_region,
                )
            )
        return cursor.last_seq if cursor else 0

    def sync_lag(self) -> list[dict]:
        with get_regional_session() as session:
            local_seq = session.scalar(select(func.max(ReplicationOutbox.seq))) or 0
            rows = session.scalars(
                select(ReplicationCursor).where(ReplicationCursor.region == self.region_id)
            ).all()
        return [
            {
                "peer_region": row.peer_region,
                "last_applied_seq": row.last_seq,
                "local_head_seq": local_seq,
                "behind_by": max(local_seq - row.last_seq, 0),
            }
            for row in rows
        ]
