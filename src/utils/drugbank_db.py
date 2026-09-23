"""
DrugBank Database Interface

Provides query functions for the DrugBank SQLite database.
Uses RapidFuzz for fuzzy name matching.
"""

import sqlite3
from pathlib import Path
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

from rapidfuzz import fuzz, process
import structlog

logger = structlog.get_logger()

# Database path
DATA_DIR = Path(__file__).parent.parent.parent / "data"
DB_PATH = DATA_DIR / "drugbank.db"


@contextmanager
def get_connection():
    """
    Context manager for database connections.
    Ensures connections are properly closed.
    """
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"DrugBank database not found at {DB_PATH}. "
            "Run the parser first: python src/utils/parser.py"
        )

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def resolve_drug_name(name: str) -> Optional[Dict[str, Any]]:
    """
    Find a drug by exact name or synonym match.

    Args:
        name: Drug name to search for (case-insensitive)

    Returns:
        Drug record dict or None if not found
    """
    with get_connection() as conn:
        cursor = conn.cursor()

        # First try exact match on drug name
        cursor.execute("""
            SELECT drugbank_id, name, type, description, indication
            FROM drugs
            WHERE name = ? COLLATE NOCASE
        """, (name,))
        row = cursor.fetchone()

        # If not found, search synonyms
        if not row:
            cursor.execute("""
                SELECT d.drugbank_id, d.name, d.type, d.description, d.indication
                FROM drugs d
                JOIN synonyms s ON d.drugbank_id = s.drug_id
                WHERE s.synonym = ? COLLATE NOCASE
            """, (name,))
            row = cursor.fetchone()

        # Also check products (brand names)
        if not row:
            cursor.execute("""
                SELECT d.drugbank_id, d.name, d.type, d.description, d.indication
                FROM drugs d
                JOIN products p ON d.drugbank_id = p.drug_id
                WHERE p.name = ? COLLATE NOCASE
            """, (name,))
            row = cursor.fetchone()

        if row:
            return dict(row)
        return None


def fuzzy_search_drugs(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Fuzzy search for drugs using RapidFuzz.

    Args:
        query: Search query string
        limit: Maximum number of results to return

    Returns:
        List of matching drug records with match scores
    """
    with get_connection() as conn:
        cursor = conn.cursor()

        # Get all drug names and synonyms for fuzzy matching
        cursor.execute("""
            SELECT DISTINCT drug_id, synonym as name FROM synonyms
            UNION
            SELECT drugbank_id, name FROM drugs
        """)

        candidates = [(row["drug_id"], row["name"]) for row in cursor.fetchall()]

        if not candidates:
            return []

        # Use RapidFuzz to find best matches
        names = [c[1] for c in candidates]
        matches = process.extract(
            query,
            names,
            scorer=fuzz.WRatio,
            limit=limit * 2  # Get extra to dedupe
        )

        # Deduplicate by drug_id and get full drug info
        seen_ids = set()
        results = []

        for match_name, score, idx in matches:
            drug_id = candidates[idx][0]
            if drug_id in seen_ids:
                continue
            seen_ids.add(drug_id)

            cursor.execute("""
                SELECT drugbank_id, name, type, description, indication
                FROM drugs WHERE drugbank_id = ?
            """, (drug_id,))
            drug_row = cursor.fetchone()

            if drug_row:
                drug = dict(drug_row)
                drug["match_score"] = score
                drug["matched_term"] = match_name
                results.append(drug)

            if len(results) >= limit:
                break

        return results


def get_drug_details(drugbank_id: str) -> Optional[Dict[str, Any]]:
    """
    Get full details for a drug including interactions.

    Args:
        drugbank_id: DrugBank ID (e.g., "DB00945")

    Returns:
        Complete drug record with interactions, or None
    """
    with get_connection() as conn:
        cursor = conn.cursor()

        # Get basic drug info
        cursor.execute("""
            SELECT drugbank_id, name, type, description, indication, mechanism_of_action
            FROM drugs WHERE drugbank_id = ?
        """, (drugbank_id,))
        row = cursor.fetchone()

        if not row:
            return None

        drug = dict(row)

        # Get drug interactions
        cursor.execute("""
            SELECT interacting_drug_id, interacting_drug_name, description
            FROM drug_interactions
            WHERE drug_id = ?
            LIMIT 50
        """, (drugbank_id,))
        drug["drug_interactions"] = [dict(r) for r in cursor.fetchall()]
        cursor.execute("SELECT COUNT(*) FROM drug_interactions WHERE drug_id = ?", (drugbank_id,))
        drug["drug_interaction_count"] = cursor.fetchone()[0]

        # Get food interactions
        cursor.execute("""
            SELECT description FROM food_interactions WHERE drug_id = ?
        """, (drugbank_id,))
        drug["food_interactions"] = [r["description"] for r in cursor.fetchall()]

        # Get categories
        cursor.execute("""
            SELECT category FROM categories WHERE drug_id = ?
        """, (drugbank_id,))
        drug["categories"] = [r["category"] for r in cursor.fetchall()]

        # Get synonyms (limited)
        cursor.execute("""
            SELECT synonym FROM synonyms WHERE drug_id = ? LIMIT 10
        """, (drugbank_id,))
        drug["synonyms"] = [r["synonym"] for r in cursor.fetchall()]

        return drug


def check_drug_interactions(drug_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Check for interactions between a list of drugs.

    Args:
        drug_ids: List of DrugBank IDs to check for interactions

    Returns:
        List of interaction records between the specified drugs
    """
    if len(drug_ids) < 2:
        return []

    with get_connection() as conn:
        cursor = conn.cursor()

        # Build query to find interactions between any pair of drugs
        placeholders = ",".join("?" * len(drug_ids))

        cursor.execute(f"""
            SELECT
                di.drug_id,
                d1.name as drug_name,
                di.interacting_drug_id,
                di.interacting_drug_name,
                di.description
            FROM drug_interactions di
            JOIN drugs d1 ON di.drug_id = d1.drugbank_id
            WHERE di.drug_id IN ({placeholders})
              AND di.interacting_drug_id IN ({placeholders})
        """, drug_ids + drug_ids)

        interactions = [dict(r) for r in cursor.fetchall()]

        # Deduplicate (A->B and B->A are the same interaction)
        seen = set()
        unique_interactions = []
        for interaction in interactions:
            pair = tuple(sorted([interaction["drug_id"], interaction["interacting_drug_id"]]))
            if pair not in seen:
                seen.add(pair)
                unique_interactions.append(interaction)

        return unique_interactions


def get_food_interactions(drugbank_id: str) -> List[str]:
    """
    Get food interactions for a specific drug.

    Args:
        drugbank_id: DrugBank ID

    Returns:
        List of food interaction descriptions
    """
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT description FROM food_interactions WHERE drug_id = ?
        """, (drugbank_id,))
        return [r["description"] for r in cursor.fetchall()]


def get_drugs_by_ids(drug_ids: List[str]) -> List[Dict[str, Any]]:
    """Return selected drugs in the requested order without fuzzy matching."""
    if not drug_ids:
        return []
    placeholders = ",".join("?" for _ in drug_ids)
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT drugbank_id, name, type FROM drugs WHERE drugbank_id IN ({placeholders})",
            drug_ids,
        ).fetchall()
        by_id = {row["drugbank_id"]: dict(row) for row in rows}
        return [by_id[drug_id] for drug_id in drug_ids if drug_id in by_id]
