"""Find repeated, explicitly named themes in distinct pairwise interaction records.

These groups are a navigation aid, not a model of multi-drug effects or severity.
"""

from __future__ import annotations

import re
from typing import Any


THEMES = (
    (
        "bleeding",
        "Bleeding",
        re.compile(r"\b(?:bleed(?:ing|s)?|ha?emorrhag\w*)\b", re.I),
    ),
    (
        "serotonin_syndrome",
        "Serotonin syndrome",
        re.compile(r"\bserotonin syndrome\b", re.I),
    ),
    (
        "cns_depression",
        "CNS depression",
        re.compile(r"\b(?:cns|central nervous system) depression\b", re.I),
    ),
    ("sedation", "Sedation", re.compile(r"\bsedat(?:ion|ive)\b", re.I)),
    (
        "anticoagulant_increase",
        "Increased anticoagulant activity",
        re.compile(
            r"\b(?:increase|increased|increases|enhance|enhanced|enhances)\s+(?:the\s+)?anticoagulant activit(?:y|ies)\b",
            re.I,
        ),
    ),
    (
        "qt_prolongation",
        "QT prolongation",
        re.compile(
            r"\b(?:qt(?:c)?(?: interval)? prolongation|prolong(?:ed|s)? (?:the )?qt(?:c)?(?: interval)?)\b",
            re.I,
        ),
    ),
    ("hypotension", "Hypotension", re.compile(r"\bhypotension\b", re.I)),
    ("hyperkalemia", "Hyperkalemia", re.compile(r"\bhyperkal(?:a)?emia\b", re.I)),
    ("hypoglycemia", "Hypoglycemia", re.compile(r"\bhypoglyc(?:a)?emia\b", re.I)),
)


def group_related_warnings(interactions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Return themes recorded for at least two different medication pairs."""
    groups: dict[str, dict[str, Any]] = {
        key: {"key": key, "title": title, "pairs": []} for key, title, _ in THEMES
    }
    seen: set[tuple[str, str]] = set()
    for item in interactions:
        pair = tuple(sorted((item["drug_id"], item["interacting_drug_id"])))
        if pair in seen:
            continue
        seen.add(pair)
        description = item.get("description") or ""
        for key, _, pattern in THEMES:
            if pattern.search(description):
                groups[key]["pairs"].append(item)
    return sorted(
        (group for group in groups.values() if len(group["pairs"]) >= 2),
        key=lambda group: (-len(group["pairs"]), group["title"]),
    )
