from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Optional

import httpx
import numpy as np

from globe.config import get_settings

if TYPE_CHECKING:
    from globe.db.regional_database import RegionalPostgresDatabase


@dataclass
class RetrievedChunk:
    doc_id: str
    title: str
    body: str
    region: str
    score: float


class EmbeddingClient:
    async def embed(self, text: str) -> list[float]:
        settings = get_settings()
        if not settings.llm_enabled:
            return _hash_embedding(text)
        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
        payload = {"model": "text-embedding-3-small", "input": text}
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openai_base_url}/embeddings",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        return data["data"][0]["embedding"]


def _hash_embedding(text: str, dim: int = 1536) -> list[float]:
    """Deterministic dev fallback when OpenAI is unavailable."""
    digest = hashlib.sha256(text.encode()).digest()
    rng = np.random.default_rng(int.from_bytes(digest[:8], "big"))
    vec = rng.standard_normal(dim)
    vec = vec / np.linalg.norm(vec)
    return vec.tolist()


class InferenceClient:
    """LLM client with streaming support and production-safe fallbacks."""

    def __init__(self) -> None:
        self._cache: dict[str, str] = {}
        self._cache_hits = 0
        self._cache_misses = 0

    def _cache_key(self, system: str, user: str) -> str:
        return hashlib.sha256(f"{system}\n---\n{user}".encode()).hexdigest()

    async def complete(self, system: str, user: str) -> tuple[str, dict]:
        settings = get_settings()
        key = self._cache_key(system, user)
        if key in self._cache:
            self._cache_hits += 1
            return self._cache[key], {"provider": "cache", "cached": True, "latency_ms": 0.1}

        self._cache_misses += 1
        start = time.perf_counter()

        if settings.llm_enabled:
            text, meta = await self._openai_complete(settings, system, user)
        elif settings.is_production:
            raise RuntimeError("OPENAI_API_KEY is required in production")
        else:
            text, meta = self._dev_complete(system, user)
            meta["provider"] = "dev"

        meta["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
        meta["cached"] = False
        self._cache[key] = text
        return text, meta

    async def stream(self, system: str, user: str):
        settings = get_settings()
        if not settings.llm_enabled:
            if settings.is_production:
                raise RuntimeError("OPENAI_API_KEY is required in production")
            text, _ = self._dev_complete(system, user)
            yield text
            return

        headers = {
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Accept": "text/event-stream",
        }
        payload = {
            "model": settings.openai_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
            "stream": True,
        }
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream(
                "POST",
                f"{settings.openai_base_url}/chat/completions",
                headers=headers,
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data = line[6:].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    delta = chunk["choices"][0]["delta"].get("content")
                    if delta:
                        yield delta

    async def _openai_complete(self, settings, system: str, user: str) -> tuple[str, dict]:
        headers = {"Authorization": f"Bearer {settings.openai_api_key}"}
        payload = {
            "model": settings.openai_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.2,
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.openai_base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            data = response.json()
        content = data["choices"][0]["message"]["content"]
        return content, {"provider": "openai", "model": settings.openai_model}

    def _dev_complete(self, system: str, user: str) -> tuple[str, dict]:
        import re

        chunks: list[str] = []
        for match in re.finditer(
            r"\[(\d+)\] title='([^']+)' region=(\S+) score=([\d.]+)\n(.*?)(?=\n\n\[|\Z)",
            user,
            re.S,
        ):
            idx, title, region, score, body = match.groups()
            excerpt = body.strip().replace("\n", " ")[:220]
            chunks.append(f"[{idx}] **{title}** ({region}, score {score}): {excerpt}")

        routed = re.search(r"Routed region: ([^\n]+)", user)
        region_line = (
            f"Routed to **{routed.group(1).strip()}** for this query.\n\n" if routed else ""
        )
        if chunks:
            answer = (
                f"{region_line}Based on retrieved knowledge documents:\n\n"
                + "\n\n".join(f"- {c}" for c in chunks)
            )
        else:
            answer = f"{region_line}Based on available context:\n{user[:300].replace(chr(10), ' ')}"
        return answer, {"provider": "dev", "model": "local-heuristic"}

    def stats(self) -> dict:
        total = self._cache_hits + self._cache_misses
        hit_rate = (self._cache_hits / total) if total else 0.0
        return {
            "cache_entries": len(self._cache),
            "cache_hits": self._cache_hits,
            "cache_misses": self._cache_misses,
            "hit_rate": round(hit_rate, 3),
        }


class RAGIndex:
    def __init__(self, regional_db: Optional["RegionalPostgresDatabase"] = None) -> None:
        self._embedder = EmbeddingClient()
        self._regional_db = regional_db
        self._docs: list[dict] = []

    async def rebuild_async(self, documents: list[dict]) -> None:
        self._docs = documents
        if not self._regional_db or not documents:
            return
        settings = get_settings()
        if not settings.llm_enabled and settings.is_production:
            return
        for doc in documents:
            text = f"{doc['title']}\n{doc['body']}"
            try:
                embedding = await self._embedder.embed(text)
                self._regional_db.update_embedding(doc["id"], embedding)
            except Exception:
                pass

    def rebuild(self, documents: list[dict]) -> None:
        self._docs = documents

    async def search(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.3,
        region: str | None = None,
        organization_id: str | None = None,
    ) -> list[RetrievedChunk]:
        settings = get_settings()
        if self._regional_db and settings.llm_enabled:
            try:
                embedding = await self._embedder.embed(query)
                hits = self._regional_db.search_knowledge_vector(
                    embedding,
                    top_k=top_k,
                    organization_id=organization_id,
                    region=region,
                )
                if hits:
                    return [
                        RetrievedChunk(
                            doc_id=h["id"],
                            title=h["title"],
                            body=h["body"],
                            region=h["region"],
                            score=round(float(h["score"]), 4),
                        )
                        for h in hits
                        if float(h["score"]) >= min_score
                    ]
            except Exception:
                pass

        return self._keyword_search(query, top_k, min_score, region)

    def _keyword_search(
        self, query: str, top_k: int, min_score: float, region: str | None
    ) -> list[RetrievedChunk]:
        if not self._docs:
            return []
        ql = query.lower()
        scored: list[tuple[float, dict]] = []
        for doc in self._docs:
            if region and doc.get("region") != region:
                continue
            blob = f"{doc['title']} {doc['body']}".lower()
            words = [w for w in ql.split() if len(w) > 2]
            if not words:
                continue
            hits = sum(1 for w in words if w in blob)
            score = hits / len(words)
            if score >= min_score:
                scored.append((score, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [
            RetrievedChunk(
                doc_id=d["id"],
                title=d["title"],
                body=d["body"],
                region=d["region"],
                score=round(s, 4),
            )
            for s, d in scored[:top_k]
        ]

    def as_context(self, chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "No supporting documents found."
        lines = []
        for i, chunk in enumerate(chunks, start=1):
            lines.append(
                f"[{i}] title={chunk.title!r} region={chunk.region} score={chunk.score}\n{chunk.body}"
            )
        return "\n\n".join(lines)
