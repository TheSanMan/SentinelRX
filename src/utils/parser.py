"""
DrugBank XML Parser - Ingestion Script
Parses the DrugBank XML file and populates a local SQLite database.
"""

import sqlite3
from pathlib import Path
from typing import Iterator, Dict, Any, List, Optional
from lxml import etree

import structlog

logger = structlog.get_logger()

# Paths
DATA_DIR = Path(__file__).parent.parent.parent / "data"
XML_PATH = DATA_DIR / "drugbank.xml"
DB_PATH = DATA_DIR / "drugbank.db"

# DrugBank XML namespace
NS = "{http://www.drugbank.ca}"


def create_tables(conn: sqlite3.Connection) -> None:
    """
    Create the necessary tables for storing drug data.

    Schema:
    - drugs: Basic drug info (drugbank_id, name, type, description, indication)
    - drug_interactions: Pairs of drugs that interact (drug1_id, drug2_id, description)
    - food_interactions: Drug + food interaction text
    - synonyms: Alternative names for drugs (for fuzzy matching)
    """
    cursor = conn.cursor()

    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON")

    # Main drugs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS drugs (
            drugbank_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            description TEXT,
            indication TEXT,
            mechanism_of_action TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Drug-drug interactions table
    # Note: We store both the interacting drug's DrugBank ID and name
    # because not all referenced drugs may be in our database
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS drug_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id TEXT NOT NULL,
            interacting_drug_id TEXT,
            interacting_drug_name TEXT,
            description TEXT,
            FOREIGN KEY (drug_id) REFERENCES drugs(drugbank_id)
        )
    """)

    # Food interactions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS food_interactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id TEXT NOT NULL,
            description TEXT NOT NULL,
            FOREIGN KEY (drug_id) REFERENCES drugs(drugbank_id)
        )
    """)

    # Synonyms table for fuzzy matching
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS synonyms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id TEXT NOT NULL,
            synonym TEXT NOT NULL,
            language TEXT DEFAULT 'english',
            FOREIGN KEY (drug_id) REFERENCES drugs(drugbank_id)
        )
    """)

    # Products table (brand names)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id TEXT NOT NULL,
            name TEXT NOT NULL,
            labeller TEXT,
            route TEXT,
            dosage_form TEXT,
            country TEXT,
            FOREIGN KEY (drug_id) REFERENCES drugs(drugbank_id)
        )
    """)

    # Categories table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drug_id TEXT NOT NULL,
            category TEXT NOT NULL,
            mesh_id TEXT,
            FOREIGN KEY (drug_id) REFERENCES drugs(drugbank_id)
        )
    """)

    conn.commit()
    logger.info("Database tables created successfully")


def create_indexes(conn: sqlite3.Connection) -> None:
    """
    Create indexes for fast lookups.
    """
    cursor = conn.cursor()

    # Index on drug name for fast name searches
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_drugs_name
        ON drugs(name COLLATE NOCASE)
    """)

    # Index on synonyms for fuzzy matching
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_synonyms_synonym
        ON synonyms(synonym COLLATE NOCASE)
    """)

    # Index on drug interactions
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_drug_interactions_drug_id
        ON drug_interactions(drug_id)
    """)

    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_drug_interactions_interacting_id
        ON drug_interactions(interacting_drug_id)
    """)

    # Index on food interactions
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_food_interactions_drug_id
        ON food_interactions(drug_id)
    """)

    # Index on products
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_products_name
        ON products(name COLLATE NOCASE)
    """)

    # Full-text search index for drug descriptions (optional but powerful)
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS drugs_fts USING fts5(
            drugbank_id,
            name,
            description,
            indication,
            content='drugs',
            content_rowid='rowid'
        )
    """)

    conn.commit()
    logger.info("Database indexes created successfully")


def get_text(element: Optional[etree._Element], tag: str) -> Optional[str]:
    """
    Safely extract text from a child element.
    """
    if element is None:
        return None
    child = element.find(f"{NS}{tag}")
    if child is not None and child.text:
        return child.text.strip()
    return None


def get_all_text(element: Optional[etree._Element], tag: str) -> List[str]:
    """
    Extract text from all matching child elements.
    """
    if element is None:
        return []
    children = element.findall(f"{NS}{tag}")
    return [child.text.strip() for child in children if child.text]


def extract_drug_data(elem: etree._Element) -> Dict[str, Any]:
    """
    Extract all relevant data from a drug element.
    """
    # Get primary DrugBank ID (the one with primary="true" attribute)
    primary_id = None
    all_ids = []
    drugbank_ids = elem.findall(f"{NS}drugbank-id")

    for db_id in drugbank_ids:
        if db_id.text:
            all_ids.append(db_id.text.strip())
            if db_id.get("primary") == "true":
                primary_id = db_id.text.strip()

    # Fallback to first ID if no primary designated
    if not primary_id and all_ids:
        primary_id = all_ids[0]

    # Basic info
    drug_data = {
        "drugbank_id": primary_id,
        "name": get_text(elem, "name"),
        "type": elem.get("type"),
        "description": get_text(elem, "description"),
        "indication": get_text(elem, "indication"),
        "mechanism_of_action": get_text(elem, "mechanism-of-action"),
        "synonyms": [],
        "drug_interactions": [],
        "food_interactions": [],
        "products": [],
        "categories": [],
    }

    # Extract synonyms
    synonyms_elem = elem.find(f"{NS}synonyms")
    if synonyms_elem is not None:
        for syn in synonyms_elem.findall(f"{NS}synonym"):
            if syn.text:
                drug_data["synonyms"].append({
                    "synonym": syn.text.strip(),
                    "language": syn.get("language", "english")
                })

    # Also add the drug name and secondary IDs as searchable terms
    if drug_data["name"]:
        drug_data["synonyms"].append({
            "synonym": drug_data["name"],
            "language": "english"
        })

    # Extract drug-drug interactions
    interactions_elem = elem.find(f"{NS}drug-interactions")
    if interactions_elem is not None:
        for interaction in interactions_elem.findall(f"{NS}drug-interaction"):
            interaction_data = {
                "drugbank_id": get_text(interaction, "drugbank-id"),
                "name": get_text(interaction, "name"),
                "description": get_text(interaction, "description")
            }
            drug_data["drug_interactions"].append(interaction_data)

    # Extract food interactions
    food_interactions_elem = elem.find(f"{NS}food-interactions")
    if food_interactions_elem is not None:
        for food_int in food_interactions_elem.findall(f"{NS}food-interaction"):
            if food_int.text:
                drug_data["food_interactions"].append(food_int.text.strip())

    # Extract products (brand names)
    products_elem = elem.find(f"{NS}products")
    if products_elem is not None:
        for product in products_elem.findall(f"{NS}product"):
            product_data = {
                "name": get_text(product, "name"),
                "labeller": get_text(product, "labeller"),
                "route": get_text(product, "route"),
                "dosage_form": get_text(product, "dosage-form"),
                "country": get_text(product, "country")
            }
            if product_data["name"]:
                drug_data["products"].append(product_data)

    # Extract categories
    categories_elem = elem.find(f"{NS}categories")
    if categories_elem is not None:
        for category in categories_elem.findall(f"{NS}category"):
            cat_data = {
                "category": get_text(category, "category"),
                "mesh_id": get_text(category, "mesh-id")
            }
            if cat_data["category"]:
                drug_data["categories"].append(cat_data)

    return drug_data


def parse_drugs(xml_path: Path) -> Iterator[Dict[str, Any]]:
    """
    Stream-parse the DrugBank XML file and yield drug records.

    Uses lxml.etree.iterparse to process one <drug> element at a time,
    which is memory-efficient for large XML files (1GB+).
    """
    logger.info("Starting XML parsing", path=str(xml_path))

    # Use iterparse for memory-efficient streaming
    context = etree.iterparse(
        str(xml_path),
        events=("end",),
        tag=f"{NS}drug"
    )

    for event, elem in context:
        # Only process top-level drugs (not nested drug elements)
        parent = elem.getparent()
        if parent is not None and parent.tag == f"{NS}drugbank":
            try:
                drug_data = extract_drug_data(elem)
                if drug_data["drugbank_id"]:
                    yield drug_data
            except Exception as e:
                logger.error(
                    "Error parsing drug element",
                    error=str(e),
                    drugbank_id=get_text(elem, "drugbank-id")
                )

        # CRITICAL: Clear the element to free memory
        # This is the key to handling large XML files
        elem.clear()

        # Also clear preceding siblings that are no longer needed
        while elem.getprevious() is not None:
            del elem.getparent()[0]

    del context


def insert_drug(conn: sqlite3.Connection, drug: Dict[str, Any]) -> None:
    """
    Insert a single drug record into the database.
    Uses parameterized queries to prevent SQL injection.
    """
    cursor = conn.cursor()

    try:
        # Insert main drug record
        cursor.execute("""
            INSERT OR REPLACE INTO drugs
            (drugbank_id, name, type, description, indication, mechanism_of_action)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            drug["drugbank_id"],
            drug["name"],
            drug["type"],
            drug["description"],
            drug["indication"],
            drug["mechanism_of_action"]
        ))

        # Insert synonyms
        for synonym in drug["synonyms"]:
            cursor.execute("""
                INSERT INTO synonyms (drug_id, synonym, language)
                VALUES (?, ?, ?)
            """, (
                drug["drugbank_id"],
                synonym["synonym"],
                synonym.get("language", "english")
            ))

        # Insert drug interactions
        for interaction in drug["drug_interactions"]:
            cursor.execute("""
                INSERT INTO drug_interactions
                (drug_id, interacting_drug_id, interacting_drug_name, description)
                VALUES (?, ?, ?, ?)
            """, (
                drug["drugbank_id"],
                interaction["drugbank_id"],
                interaction["name"],
                interaction["description"]
            ))

        # Insert food interactions
        for food_int in drug["food_interactions"]:
            cursor.execute("""
                INSERT INTO food_interactions (drug_id, description)
                VALUES (?, ?)
            """, (drug["drugbank_id"], food_int))

        # Insert products
        for product in drug["products"]:
            cursor.execute("""
                INSERT INTO products
                (drug_id, name, labeller, route, dosage_form, country)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                drug["drugbank_id"],
                product["name"],
                product["labeller"],
                product["route"],
                product["dosage_form"],
                product["country"]
            ))

        # Insert categories
        for category in drug["categories"]:
            cursor.execute("""
                INSERT INTO categories (drug_id, category, mesh_id)
                VALUES (?, ?, ?)
            """, (
                drug["drugbank_id"],
                category["category"],
                category["mesh_id"]
            ))

    except sqlite3.Error as e:
        logger.error(
            "Database insertion error",
            drugbank_id=drug["drugbank_id"],
            error=str(e)
        )
        raise


def populate_fts_index(conn: sqlite3.Connection) -> None:
    """
    Populate the full-text search index after all drugs are inserted.
    """
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO drugs_fts (drugbank_id, name, description, indication)
        SELECT drugbank_id, name, description, indication FROM drugs
    """)
    conn.commit()
    logger.info("Full-text search index populated")


def build_database() -> None:
    """
    Main entry point to build the DrugBank SQLite database.
    """
    logger.info("Starting DrugBank ingestion", xml_path=str(XML_PATH))

    if not XML_PATH.exists():
        logger.error("DrugBank XML not found", path=str(XML_PATH))
        raise FileNotFoundError(
            f"DrugBank XML not found. Please download from DrugBank and save to: {XML_PATH}\n"
            "Note: DrugBank requires registration at https://go.drugbank.com/"
        )

    # Create data directory if it doesn't exist
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Remove old database if it exists
    if DB_PATH.exists():
        logger.info("Removing existing database", path=str(DB_PATH))
        DB_PATH.unlink()

    # Connect to SQLite database
    conn = sqlite3.connect(DB_PATH)

    try:
        # Create tables
        create_tables(conn)

        # Parse and insert drugs
        count = 0
        batch_size = 100

        for drug in parse_drugs(XML_PATH):
            insert_drug(conn, drug)
            count += 1

            # Commit in batches for better performance
            if count % batch_size == 0:
                conn.commit()

            # Log progress
            if count % 1000 == 0:
                logger.info("Progress", drugs_processed=count)

        # Final commit
        conn.commit()

        # Create indexes after all data is inserted (more efficient)
        create_indexes(conn)

        # Populate full-text search index
        populate_fts_index(conn)

        logger.info("Ingestion complete", total_drugs=count, db_path=str(DB_PATH))

    except Exception as e:
        conn.rollback()
        logger.error("Ingestion failed", error=str(e))
        raise
    finally:
        conn.close()


def query_drug(name: str) -> Optional[Dict[str, Any]]:
    """
    Query a drug by name (utility function for testing).
    Searches drug names and synonyms.
    """
    if not DB_PATH.exists():
        logger.error("Database not found", path=str(DB_PATH))
        return None

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # First try exact match on drug name
        cursor.execute("""
            SELECT * FROM drugs WHERE name = ? COLLATE NOCASE
        """, (name,))
        row = cursor.fetchone()

        # If not found, search synonyms
        if not row:
            cursor.execute("""
                SELECT d.* FROM drugs d
                JOIN synonyms s ON d.drugbank_id = s.drug_id
                WHERE s.synonym = ? COLLATE NOCASE
            """, (name,))
            row = cursor.fetchone()

        if row:
            drug = dict(row)

            # Get interactions
            cursor.execute("""
                SELECT * FROM drug_interactions WHERE drug_id = ?
            """, (drug["drugbank_id"],))
            drug["interactions"] = [dict(r) for r in cursor.fetchall()]

            # Get food interactions
            cursor.execute("""
                SELECT description FROM food_interactions WHERE drug_id = ?
            """, (drug["drugbank_id"],))
            drug["food_interactions"] = [r[0] for r in cursor.fetchall()]

            return drug

        return None

    finally:
        conn.close()


def search_drugs(query: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Full-text search for drugs.
    """
    if not DB_PATH.exists():
        return []

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT d.* FROM drugs_fts fts
            JOIN drugs d ON fts.drugbank_id = d.drugbank_id
            WHERE drugs_fts MATCH ?
            LIMIT ?
        """, (query, limit))

        return [dict(row) for row in cursor.fetchall()]

    finally:
        conn.close()


if __name__ == "__main__":
    build_database()
