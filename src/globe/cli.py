from __future__ import annotations

import argparse
import asyncio
import json

import httpx


async def _get(client: httpx.AsyncClient, url: str, params: dict | None = None) -> dict:
    response = await client.get(url, params=params)
    response.raise_for_status()
    return response.json()


async def _post(client: httpx.AsyncClient, url: str, payload: dict) -> dict:
    response = await client.post(url, json=payload)
    response.raise_for_status()
    return response.json()


async def demo_flow(base_url: str, api_key: str = "") -> None:
    headers = {"X-API-Key": api_key} if api_key else {}
    api = f"{base_url}/api/v1"

    print("=== GlobeCloud Product Demo ===\n")

    async with httpx.AsyncClient(timeout=30.0, headers=headers) as client:
        product = await _get(client, f"{api}/product")
        print(f"Product: {product['name']} v{product['version']}\n")

        route = await _get(
            client,
            f"{api}/route",
            params={"client_lat": 40.0, "client_lon": -74.0},
        )
        print("Geo routing (NYC client):")
        print(json.dumps(route, indent=2))
        print()

        region = route["selected_region"]
        products = await _get(client, f"{api}/regions/{region}/products")
        print(f"Regional inventory ({region}):")
        print(json.dumps(products, indent=2))
        print()

        product_list = products.get("products", [])
        if not product_list:
            raise SystemExit("No products in catalog — run ./scripts/import-catalog.sh --local")
        product_id = product_list[0]["id"]

        order = await _post(
            client,
            f"{api}/regions/{region}/orders",
            {"product_id": product_id, "quantity": 2},
        )
        print("Created order:")
        print(json.dumps(order, indent=2))
        print()

        sync = await _post(client, f"{api}/sync/run", {})
        print("Replication cycle:")
        print(json.dumps(sync, indent=2))
        print()

        search = await _get(client, f"{api}/knowledge/search", params={"q": "replication"})
        print("RAG search:")
        print(json.dumps(search, indent=2))
        print()

        agent = await _post(
            client,
            f"{api}/agent/ask",
            {
                "question": "How does this system handle replication and reduce AI hallucinations?",
                "client_lat": 40.0,
                "client_lon": -74.0,
            },
        )
        print("Grounded agent response:")
        print(json.dumps(agent, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description="GlobeCloud CLI")
    parser.add_argument(
        "command",
        choices=["demo"],
        help="Run an end-to-end demo against a running server",
    )
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--api-key", default="", help="X-API-Key if auth is enabled")
    args = parser.parse_args()

    if args.command == "demo":
        asyncio.run(demo_flow(args.base_url, args.api_key))


if __name__ == "__main__":
    main()
