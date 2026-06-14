from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Callable, Optional

from globe.database.models import DatabaseCluster

logger = logging.getLogger(__name__)


@dataclass
class ReplicationEngine:
    cluster: DatabaseCluster
    interval_s: float = 2.0
    on_sync: Optional[Callable[[], None]] = None
    _task: asyncio.Task | None = field(default=None, init=False)
    _running: bool = field(default=False, init=False)
    _cycles: int = field(default=0, init=False)
    _last_applied: int = field(default=0, init=False)
    _peer_errors: int = field(default=0, init=False)

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.create_task(self._loop())

    async def stop(self) -> None:
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def sync_once(self) -> dict:
        if self.cluster.deployment_mode == "regional":
            return await self._sync_regional()
        return await self._sync_local()

    async def _sync_local(self) -> dict:
        applied = 0
        region_ids = list(self.cluster.regions.keys())
        for target_id in region_ids:
            target = self.cluster.get(target_id)
            for source_id in region_ids:
                if source_id == target_id:
                    continue
                source = self.cluster.get(source_id)
                last_seq = target.get_sync_cursor(source_id)
                entries = source.replication_entries_since(last_seq)
                max_seq = last_seq
                for entry in entries:
                    if entry["origin_region"] == target_id:
                        continue
                    target.apply_replication_entry(entry)
                    applied += 1
                    max_seq = max(max_seq, entry.get("seq", 0))
                if max_seq > last_seq:
                    target.update_sync_cursor(source_id, max_seq)
        self._cycles += 1
        self._last_applied = applied
        result = {"cycles": self._cycles, "entries_applied": applied, "mode": "local"}
        if applied > 0 and self.on_sync:
            self.on_sync()
        return result

    async def _sync_regional(self) -> dict:
        applied = 0
        local = self.cluster.local_db()
        local_id = self.cluster.local_region_id

        for peer_id, peer in self.cluster.peers.items():
            last_seq = local.get_sync_cursor(peer_id)

            try:
                entries = await peer.fetch_replication_log(last_seq)
            except Exception as exc:
                self._peer_errors += 1
                logger.warning("Replication fetch failed for peer %s: %s", peer_id, exc)
                continue

            max_seq = last_seq
            for entry in entries:
                if entry.get("origin_region") == local_id:
                    continue
                local.apply_replication_entry(entry)
                applied += 1
                max_seq = max(max_seq, entry.get("seq", 0))

            if max_seq > last_seq:
                local.update_sync_cursor(peer_id, max_seq)

        self._cycles += 1
        self._last_applied = applied
        result = {"cycles": self._cycles, "entries_applied": applied, "mode": "regional"}
        if applied > 0 and self.on_sync:
            self.on_sync()
        return result

    async def _loop(self) -> None:
        while self._running:
            await self.sync_once()
            await asyncio.sleep(self.interval_s)

    def status(self) -> dict:
        per_region = {}
        for region_id in self.cluster.region_ids():
            if self.cluster.is_local(region_id):
                db = self.cluster.get(region_id)
                per_region[region_id] = {
                    "local": True,
                    "stats": db.stats(),
                    "sync_lag": db.sync_lag(),
                }
            else:
                per_region[region_id] = {
                    "local": False,
                    "peer_url": self.cluster.peer_urls.get(region_id),
                    "stats": None,
                    "sync_lag": [],
                }

        if self.cluster.deployment_mode == "regional":
            local = self.cluster.local_db()
            per_region[self.cluster.local_region_id]["stats"] = local.stats()
            per_region[self.cluster.local_region_id]["sync_lag"] = local.sync_lag()

        return {
            "running": self._running,
            "mode": self.cluster.deployment_mode,
            "local_region": self.cluster.local_region_id,
            "interval_s": self.interval_s,
            "cycles": self._cycles,
            "last_entries_applied": self._last_applied,
            "peer_errors": self._peer_errors,
            "regions": per_region,
        }
