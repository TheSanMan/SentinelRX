"""
MCP Tools for Drug Lookup and Interaction Checking

These tools are exposed via the FastMCP server and can be called
by AI agents to query drug information and check for interactions.
"""

from typing import List, Optional
import structlog

from src.utils.drugbank_db import (
    resolve_drug_name,
    fuzzy_search_drugs,
    get_drug_details,
    check_drug_interactions,
    get_food_interactions,
)

logger = structlog.get_logger()


async def lookup_drug(name: str) -> dict:
    """
    Search for a drug by name. Returns matching drugs with basic info.

    Supports exact matches, synonyms, brand names, and fuzzy matching.
    Use this tool when you need to find a drug or verify a drug name.

    Args:
        name: Drug name to search for (e.g., "aspirin", "Tylenol", "acetaminophen")

    Returns:
        Dictionary with exact_match (if found) and fuzzy_matches (similar drugs)
    """
    logger.info("Looking up drug", name=name)

    result = {
        "query": name,
        "exact_match": None,
        "fuzzy_matches": []
    }

    # Try exact match first
    exact = resolve_drug_name(name)
    if exact:
        result["exact_match"] = {
            "drugbank_id": exact["drugbank_id"],
            "name": exact["name"],
            "type": exact["type"],
            "description": (exact.get("description") or "")[:500] + "..."
                if exact.get("description") and len(exact.get("description", "")) > 500
                else exact.get("description")
        }
        logger.info("Found exact match", drugbank_id=exact["drugbank_id"])
        return result

    # Fall back to fuzzy search
    fuzzy_results = fuzzy_search_drugs(name, limit=5)
    result["fuzzy_matches"] = [
        {
            "drugbank_id": drug["drugbank_id"],
            "name": drug["name"],
            "match_score": drug["match_score"],
            "matched_term": drug["matched_term"]
        }
        for drug in fuzzy_results
    ]

    if fuzzy_results:
        logger.info("Found fuzzy matches", count=len(fuzzy_results))
    else:
        logger.warning("No matches found", query=name)

    return result


async def get_drug_info(drugbank_id: str) -> dict:
    """
    Get detailed information about a specific drug.

    Use this tool after lookup_drug to get full details including
    interactions, categories, and mechanism of action.

    Args:
        drugbank_id: DrugBank ID (e.g., "DB00945" for Aspirin)

    Returns:
        Complete drug information including interactions
    """
    logger.info("Getting drug info", drugbank_id=drugbank_id)

    details = get_drug_details(drugbank_id)

    if not details:
        return {"error": f"Drug not found: {drugbank_id}"}

    # Truncate long descriptions for readability
    if details.get("description") and len(details["description"]) > 1000:
        details["description"] = details["description"][:1000] + "..."

    if details.get("mechanism_of_action") and len(details["mechanism_of_action"]) > 500:
        details["mechanism_of_action"] = details["mechanism_of_action"][:500] + "..."

    return details


async def check_interactions(drug_names: List[str]) -> dict:
    """
    Check for known interactions between two or more drugs.

    IMPORTANT: This is the primary tool for drug safety checks.
    Always use this when a patient is taking multiple medications.

    Args:
        drug_names: List of drug names to check (e.g., ["warfarin", "aspirin"])

    Returns:
        Dictionary with resolved drugs and any interactions found
    """
    logger.info("Checking interactions", drugs=drug_names)

    if len(drug_names) < 2:
        return {"error": "Need at least 2 drugs to check interactions"}

    result = {
        "drugs_checked": [],
        "resolved_drugs": [],
        "unresolved_drugs": [],
        "interactions": [],
        "has_interactions": False
    }

    # Resolve each drug name to a DrugBank ID
    drug_ids = []
    for name in drug_names:
        result["drugs_checked"].append(name)
        drug = resolve_drug_name(name)

        if drug:
            drug_ids.append(drug["drugbank_id"])
            result["resolved_drugs"].append({
                "input_name": name,
                "drugbank_id": drug["drugbank_id"],
                "canonical_name": drug["name"]
            })
        else:
            # Try fuzzy match
            fuzzy = fuzzy_search_drugs(name, limit=1)
            if fuzzy and fuzzy[0]["match_score"] >= 80:
                drug_ids.append(fuzzy[0]["drugbank_id"])
                result["resolved_drugs"].append({
                    "input_name": name,
                    "drugbank_id": fuzzy[0]["drugbank_id"],
                    "canonical_name": fuzzy[0]["name"],
                    "fuzzy_match": True,
                    "match_score": fuzzy[0]["match_score"]
                })
            else:
                result["unresolved_drugs"].append(name)

    if len(drug_ids) < 2:
        result["warning"] = "Could not resolve enough drugs to check interactions"
        return result

    # Check for interactions
    interactions = check_drug_interactions(drug_ids)

    if interactions:
        result["has_interactions"] = True
        result["interactions"] = [
            {
                "drug1": {
                    "drugbank_id": i["drug_id"],
                    "name": i["drug_name"]
                },
                "drug2": {
                    "drugbank_id": i["interacting_drug_id"],
                    "name": i["interacting_drug_name"]
                },
                "description": i["description"]
            }
            for i in interactions
        ]
        logger.warning(
            "Interactions found",
            count=len(interactions),
            drugs=drug_names
        )
    else:
        logger.info("No interactions found", drugs=drug_names)

    return result


async def get_food_interactions_for_drug(drug_name: str) -> dict:
    """
    Get food interactions for a specific drug.

    Use this tool to check if a drug has dietary restrictions
    or food-related warnings.

    Args:
        drug_name: Name of the drug to check

    Returns:
        Dictionary with drug info and food interactions
    """
    logger.info("Getting food interactions", drug_name=drug_name)

    drug = resolve_drug_name(drug_name)

    if not drug:
        # Try fuzzy match
        fuzzy = fuzzy_search_drugs(drug_name, limit=1)
        if fuzzy and fuzzy[0]["match_score"] >= 80:
            drug = {
                "drugbank_id": fuzzy[0]["drugbank_id"],
                "name": fuzzy[0]["name"]
            }
        else:
            return {"error": f"Drug not found: {drug_name}"}

    food_ints = get_food_interactions(drug["drugbank_id"])

    return {
        "drug": {
            "drugbank_id": drug["drugbank_id"],
            "name": drug["name"]
        },
        "food_interactions": food_ints,
        "has_food_interactions": len(food_ints) > 0
    }


async def scan_label(image_path: str) -> dict:
    """
    Scan a drug label image and extract drug names using OCR.

    Use this tool to process an image of a medication label or package
    and identify the drug names mentioned on it.

    Args:
        image_path: Absolute path to the image file to scan

    Returns:
        Dictionary with extracted drug names and any matched drugs
    """
    import os
    from src.utils.ocr import extract_drug_names_from_image

    logger.info("Scanning drug label", image_path=image_path)

    if not os.path.exists(image_path):
        return {"error": f"File not found: {image_path}"}

    try:
        with open(image_path, "rb") as f:
            image_data = f.read()

        extracted_names = await extract_drug_names_from_image(image_data)

        # Try to resolve each extracted name to a drug
        resolved_drugs = []
        for name in extracted_names:
            drug = resolve_drug_name(name)
            if drug:
                resolved_drugs.append({
                    "extracted_text": name,
                    "drugbank_id": drug["drugbank_id"],
                    "canonical_name": drug["name"]
                })

        return {
            "image_path": image_path,
            "extracted_text": extracted_names,
            "resolved_drugs": resolved_drugs,
            "drugs_found": len(resolved_drugs)
        }

    except Exception as e:
        logger.error("Failed to scan label", error=str(e))
        return {"error": f"Failed to scan label: {str(e)}"}
