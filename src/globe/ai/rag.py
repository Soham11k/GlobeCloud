from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass

import httpx
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from globe.config import get_settings


@dataclass
class RetrievedChunk:
    doc_id: str
    title: str
    body: str
    region: str
    score: float


class InferenceClient:
    """LLM client with in-memory response cache to reduce repeated inference cost."""

    def __init__(self) -> None:
        self._cache: dict[str, str] = {}
        self._cache_hits = 0
        self._cache_misses = 0

    def _cache_key(self, system: str, user: str) -> str:
        digest = hashlib.sha256(f"{system}\n---\n{user}".encode()).hexdigest()
        return digest

    async def complete(self, system: str, user: str) -> tuple[str, dict]:
        settings = get_settings()
        key = self._cache_key(system, user)
        if key in self._cache:
            self._cache_hits += 1
            return self._cache[key], {
                "provider": "cache",
                "cached": True,
                "latency_ms": 0.1,
            }

        self._cache_misses += 1
        start = time.perf_counter()

        if settings.llm_enabled:
            try:
                text, meta = await self._openai_complete(settings, system, user)
            except Exception:
                text, meta = self._mock_complete(system, user)
                meta["fallback"] = "openai_error"
        else:
            text, meta = self._mock_complete(system, user)

        meta["latency_ms"] = round((time.perf_counter() - start) * 1000, 2)
        meta["cached"] = False
        self._cache[key] = text
        return text, meta

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

    def _mock_complete(self, system: str, user: str) -> tuple[str, dict]:
        # Deterministic local fallback — answers from retrieved context when available.
        import re

        chunks: list[str] = []
        for match in re.finditer(r"\[(\d+)\] title='([^']+)' region=(\S+) score=([\d.]+)\n(.*?)(?=\n\n\[|\Z)", user, re.S):
            idx, title, region, score, body = match.groups()
            excerpt = body.strip().replace("\n", " ")[:220]
            chunks.append(f"[{idx}] **{title}** ({region}, score {score}): {excerpt}")

        routed = re.search(r"Routed region: ([^\n]+)", user)
        region_line = f"Routed to **{routed.group(1).strip()}** for this query.\n\n" if routed else ""

        if chunks:
            answer = (
                f"{region_line}"
                "Based on retrieved knowledge documents:\n\n"
                + "\n\n".join(f"- {c}" for c in chunks)
            )
        else:
            summary = user[:300].replace("\n", " ")
            answer = (
                f"{region_line}"
                "Based on available context:\n"
                f"{summary}"
            )

        return answer, {"provider": "mock", "model": "local-heuristic"}

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
    def __init__(self) -> None:
        self._vectorizer = TfidfVectorizer(stop_words="english")
        self._matrix = None
        self._docs: list[dict] = []

    def rebuild(self, documents: list[dict]) -> None:
        self._docs = documents
        if not documents:
            self._matrix = None
            return
        corpus = [f"{d['title']}\n{d['body']}" for d in documents]
        self._matrix = self._vectorizer.fit_transform(corpus)

    def search(
        self,
        query: str,
        top_k: int = 3,
        min_score: float = 0.08,
        region: str | None = None,
    ) -> list[RetrievedChunk]:
        if not self._docs or self._matrix is None:
            return []
        query_vec = self._vectorizer.transform([query])
        scores = cosine_similarity(query_vec, self._matrix).flatten()
        ranked = np.argsort(scores)[::-1]
        results: list[RetrievedChunk] = []
        for idx in ranked:
            if len(results) >= top_k:
                break
            score = float(scores[idx])
            if score < min_score:
                continue
            doc = self._docs[idx]
            if region and doc.get("region") != region:
                continue
            results.append(
                RetrievedChunk(
                    doc_id=doc["id"],
                    title=doc["title"],
                    body=doc["body"],
                    region=doc["region"],
                    score=round(score, 4),
                )
            )
        if not results and region:
            return self.search(query, top_k=top_k, min_score=min_score, region=None)
        return results

    def as_context(self, chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "No supporting documents found."
        lines = []
        for i, chunk in enumerate(chunks, start=1):
            lines.append(
                f"[{i}] title={chunk.title!r} region={chunk.region} score={chunk.score}\n{chunk.body}"
            )
        return "\n\n".join(lines)
