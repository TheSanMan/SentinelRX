import httpx
import hishel
import structlog
from typing import Optional, List, Dict, Any

# TODO: Initialize the logger
logger = structlog.get_logger()

class NIHClient:
    """
    Async HTTP client for interacting with NIH APIs (RxNav).
    Uses caching to be polite and efficient.
    """

    def __init__(self, use_cache: bool = True):
        # TODO: Initialize the base URL for RxNav
        # Hint: https://rxnav.nlm.nih.gov/REST
        self.base_url = "https://rxnav.nlm.nih.gov/REST"

        # TODO: Initialize the async client
        # LEARNING GOAL:
        # 1. If use_cache is True, create a hishel.AsyncCacheClient
        # 2. If use_cache is False, create a standard httpx.AsyncClient
        # 3. Use a persistent storage for cache if possible (e.g., FileStorage),
        #    or strictly in-memory if for testing.
        self.client = httpx.AsyncClient() if not use_cache else hishel.AsyncCacheClient() # type: ignore

    async def get_rxcui_suggestions(self, drug_name: str) -> List[str]:
        """
        Get spelling suggestions for a drug name.
        Endpoint: /spellingsuggestions.json?name=...
        """
        # TODO:
        # 1. Construct the parameters (params={"name": drug_name})

        params = {"name": drug_name}
        # 2. Perform a GET request to f"{self.base_url}/spellingsuggestions.json"

        try:
            response = await self.client.get(
                f"{self.base_url}/spellingsuggestions.json", params=params
            )
        # 3. Handle potential errors (what if the API is down?)

            response.raise_for_status()
        # 4. Parse the JSON response
            data = response.json()
        # 5. Extract the list of suggestions from the deep JSON structure
        #    Note: Response structure is usually inside "suggestionGroup" -> "suggestionList" -> "suggestion"

            suggestions = data.get("suggestionGroup", {}).get("suggestionList", {}).get("suggestion", [])
        # 6. Return the list of suggestions
            return [suggestion.get("str") for suggestion in suggestions]

        except httpx.HTTPStatusError as e:
            logger.error("Failed to get RxCUI suggestions", error=str(e))
            return []

    async def resolve_rxcui(self, name: str) -> Optional[str]:
        """
        Exact match a name to an RxCUI.
        Endpoint: /rxcui.json?name=...
        """
        params = {"name": name}
        try:
            response = await self.client.get(
                f"{self.base_url}/rxcui.json", params=params
            )
            response.raise_for_status()
            data = response.json()
            # Fix: Correctly parse the nested JSON structure
            # Structure: {"idGroup": {"rxnormId": ["12345"]}}
            id_group = data.get("idGroup", {})
            rxnorm_ids = id_group.get("rxnormId", [])
            return rxnorm_ids[0] if rxnorm_ids else None
        except (httpx.HTTPStatusError, IndexError, KeyError) as e:
            logger.error("Failed to resolve RxCUI", error=str(e))
            return None

    async def close(self):
        """Clean up resources."""
        await self.client.aclose()

    # Context manager support (optional but good practice)
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
