from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from globe.database.models import utcnow


OBSERVABILITY_SCHEMA = """
CREATE TABLE IF NOT EXISTS metrics_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    region_id TEXT,
    metric TEXT NOT NULL,
    value REAL NOT NULL,
    labels TEXT NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS routing_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    client_lat REAL NOT NULL,
    client_lon REAL NOT NULL,
    selected_region TEXT NOT NULL,
    latencies TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    request_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status INTEGER NOT NULL,
    duration_ms REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_metrics_ts ON metrics_samples(ts);
CREATE INDEX IF NOT EXISTS idx_routing_ts ON routing_events(ts);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
"""


class ObservabilityStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self._connect() as conn:
            conn.executescript(OBSERVABILITY_SCHEMA)
            conn.commit()

    def record_metric(
        self,
        metric: str,
        value: float,
        *,
        region_id: str | None = None,
        labels: dict | None = None,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO metrics_samples (ts, region_id, metric, value, labels)
                VALUES (?, ?, ?, ?, ?)
                """,
                (utcnow(), region_id, metric, value, json.dumps(labels or {})),
            )
            conn.commit()

    def record_routing(
        self,
        client_lat: float,
        client_lon: float,
        selected_region: str,
        latencies: list[dict],
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO routing_events (ts, client_lat, client_lon, selected_region, latencies)
                VALUES (?, ?, ?, ?, ?)
                """,
                (utcnow(), client_lat, client_lon, selected_region, json.dumps(latencies)),
            )
            conn.commit()

    def record_audit(
        self,
        request_id: str,
        method: str,
        path: str,
        status: int,
        duration_ms: float,
    ) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO audit_log (ts, request_id, method, path, status, duration_ms)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (utcnow(), request_id, method, path, status, duration_ms),
            )
            conn.commit()
            conn.execute(
                """
                DELETE FROM audit_log WHERE id NOT IN (
                    SELECT id FROM audit_log ORDER BY id DESC LIMIT 2000
                )
                """
            )
            conn.commit()

    def metrics_history(
        self,
        metric: str,
        *,
        region_id: str | None = None,
        since_hours: float = 24,
        limit: int = 500,
    ) -> list[dict]:
        since = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()
        query = """
            SELECT ts, region_id, metric, value, labels
            FROM metrics_samples
            WHERE metric = ? AND ts >= ?
        """
        params: list[Any] = [metric, since]
        if region_id:
            query += " AND region_id = ?"
            params.append(region_id)
        query += " ORDER BY ts ASC LIMIT ?"
        params.append(limit)
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        return [
            {
                "ts": row["ts"],
                "region_id": row["region_id"],
                "metric": row["metric"],
                "value": row["value"],
                "labels": json.loads(row["labels"]),
            }
            for row in rows
        ]

    def metrics_summary(self, metric: str, since_hours: float = 24) -> dict:
        since = (datetime.now(timezone.utc) - timedelta(hours=since_hours)).isoformat()
        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS n,
                       MIN(value) AS min_v,
                       MAX(value) AS max_v,
                       AVG(value) AS avg_v
                FROM metrics_samples
                WHERE metric = ? AND ts >= ?
                """,
                (metric, since),
            ).fetchone()
        if not row or row["n"] == 0:
            return {"count": 0, "min": None, "max": None, "avg": None, "p95": None}
        with self._connect() as conn:
            values = [
                r["value"]
                for r in conn.execute(
                    "SELECT value FROM metrics_samples WHERE metric = ? AND ts >= ? ORDER BY value",
                    (metric, since),
                ).fetchall()
            ]
        p95_idx = min(len(values) - 1, int(len(values) * 0.95))
        return {
            "count": row["n"],
            "min": round(row["min_v"], 2),
            "max": round(row["max_v"], 2),
            "avg": round(row["avg_v"], 2),
            "p95": round(values[p95_idx], 2) if values else None,
        }

    def list_audit(self, *, limit: int = 100, status: int | None = None) -> list[dict]:
        query = "SELECT ts, request_id, method, path, status, duration_ms FROM audit_log"
        params: list[Any] = []
        if status is not None:
            query += " WHERE status = ?"
            params.append(status)
        query += " ORDER BY id DESC LIMIT ?"
        params.append(limit)
        with self._connect() as conn:
            rows = conn.execute(query, params).fetchall()
        return [dict(row) for row in rows]

    def list_routing_events(self, limit: int = 50) -> list[dict]:
        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT ts, client_lat, client_lon, selected_region, latencies
                FROM routing_events ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [
            {
                **dict(row),
                "latencies": json.loads(row["latencies"]),
            }
            for row in rows
        ]

    def activity_feed(self, limit: int = 50) -> list[dict]:
        items: list[dict] = []
        for row in self.list_audit(limit=limit):
            items.append(
                {
                    "type": "request",
                    "ts": row["ts"],
                    "summary": f"{row['method']} {row['path']} → {row['status']}",
                    "duration_ms": row["duration_ms"],
                }
            )
        for row in self.list_routing_events(limit=limit):
            items.append(
                {
                    "type": "route",
                    "ts": row["ts"],
                    "summary": f"Routed to {row['selected_region']}",
                    "selected_region": row["selected_region"],
                }
            )
        items.sort(key=lambda x: x["ts"], reverse=True)
        return items[:limit]
