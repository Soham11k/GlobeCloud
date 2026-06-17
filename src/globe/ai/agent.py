from __future__ import annotations

import json
import re
from dataclasses import dataclass

from globe.ai.rag import InferenceClient, RAGIndex, RetrievedChunk
from globe.database.sync import ReplicationEngine
from globe.routing.geo_router import GeoRouter


@dataclass
class AgentAnswer:
    answer: str
    confidence: str
    citations: list[dict]
    tool_trace: list[dict]
    inference: dict


class DatabaseAgent:
    """Tool-using agent grounded by RAG retrieval to reduce hallucinations."""

    def __init__(
        self,
        cluster,
        router: GeoRouter,
        replicator: ReplicationEngine,
        rag: RAGIndex,
        llm: InferenceClient,
    ) -> None:
        self.cluster = cluster
        self.router = router
        self.replicator = replicator
        self.rag = rag
        self.llm = llm

    async def ask(
        self,
        question: str,
        *,
        client_lat: float = 40.0,
        client_lon: float = -74.0,
        preferred_region: str | None = None,
    ) -> AgentAnswer:
        tool_trace: list[dict] = []
        citations: list[dict] = []

        region, health = await self.router.route(client_lat, client_lon, preferred_region)
        selected_probe = next((p for p in health if p.region_id == region.id), None)
        tool_trace.append(
            {
                "tool": "route_request",
                "result": {
                    "selected_region": region.id,
                    "healthy_regions": [h.region_id for h in health if h.healthy],
                    "is_local": selected_probe.is_local if selected_probe else self.cluster.is_local(region.id),
                    "peer_url": selected_probe.peer_url if selected_probe else None,
                },
            }
        )

        products = await self.cluster.get_products(region.id)
        tool_trace.append(
            {
                "tool": "query_regional_inventory",
                "result": {"region": region.id, "product_count": len(products)},
            }
        )

        chunks = await self.rag.search(question, top_k=3, region=region.id)
        citations = [
            {
                "doc_id": c.doc_id,
                "title": c.title,
                "region": c.region,
                "score": c.score,
                "excerpt": c.body[:180],
            }
            for c in chunks
        ]
        tool_trace.append(
            {
                "tool": "retrieve_knowledge",
                "result": {"matches": len(chunks), "top_score": chunks[0].score if chunks else 0},
            }
        )

        sync_status = self.replicator.status()
        tool_trace.append(
            {
                "tool": "get_sync_status",
                "result": {
                    "running": sync_status["running"],
                    "cycles": sync_status["cycles"],
                },
            }
        )

        confidence = self._confidence(chunks)
        system = (
            "You are a cloud infrastructure assistant. "
            "Answer ONLY using the provided context and inventory facts. "
            "If evidence is insufficient, say you are unsure. "
            "Include short bullet citations like [1], [2]."
        )
        user = (
            f"Question: {question}\n\n"
            f"Routed region: {region.name} ({region.id})\n\n"
            f"Inventory sample:\n{json.dumps(products[:3], indent=2)}\n\n"
            f"Retrieved knowledge:\n{self.rag.as_context(chunks)}\n\n"
            f"Sync cycles completed: {sync_status['cycles']}"
        )

        answer, inference = await self.llm.complete(system, user)
        if confidence == "low":
            answer = (
                f"{answer}\n\n"
                "⚠ Low confidence: insufficient grounded documents were retrieved. "
                "Verify against primary sources before acting."
            )

        return AgentAnswer(
            answer=answer,
            confidence=confidence,
            citations=citations,
            tool_trace=tool_trace,
            inference=inference,
        )

    def _confidence(self, chunks: list[RetrievedChunk]) -> str:
        if not chunks:
            return "low"
        if chunks[0].score >= 0.25:
            return "high"
        if chunks[0].score >= 0.12:
            return "medium"
        return "low"

    @staticmethod
    def parse_tool_intent(question: str) -> str | None:
        q = question.lower()
        if "sync" in q or "replic" in q:
            return "sync_status"
        if "stock" in q or "inventory" in q or "product" in q:
            return "inventory"
        if re.search(r"\border\b", q):
            return "orders"
        return None
