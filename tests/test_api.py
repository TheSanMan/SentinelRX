"""Focused tests for the medication workflow and grounded assistant."""

from __future__ import annotations

import asyncio
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from src import api


class MedicationWorkflowTests(unittest.TestCase):
    def test_sentinel_uses_retrieved_records_and_caps_generation(self) -> None:
        drug = {"drugbank_id": "DB00331", "name": "Metformin"}
        response = Mock()
        response.json.return_value = {"message": {"content": "It treats diabetes."}}
        with (
            patch.object(api, "sentinel_context", return_value="DrugBank ID: DB00331\nName: Metformin"),
            patch.object(api.httpx, "post", return_value=response) as post,
        ):
            answer = api.ask_sentinel("What is it for?", [drug])
        self.assertEqual(answer, "It treats diabetes.")
        payload = post.call_args.kwargs["json"]
        self.assertIn("DB00331", payload["messages"][1]["content"])
        self.assertEqual(payload["options"]["num_predict"], 120)
        self.assertEqual(post.call_args.kwargs["timeout"], 70)

    def test_sentinel_falls_back_when_model_times_out(self) -> None:
        drug = {"drugbank_id": "DB00331", "name": "Metformin"}
        with (
            patch.object(api, "sentinel_context", return_value="DrugBank ID: DB00331"),
            patch.object(api.httpx, "post", side_effect=api.httpx.ReadTimeout("slow")),
        ):
            self.assertIsNone(api.ask_sentinel("What is it for?", [drug]))

    def test_sentinel_answer_links_the_retrieved_drug(self) -> None:
        drug = {"drugbank_id": "DB00331", "name": "Metformin"}
        with (
            patch.object(api, "get_drugs_by_ids", return_value=[drug]),
            patch.object(api, "names_in_question", return_value=[]),
            patch.object(api, "ask_sentinel", return_value="A database-grounded summary."),
        ):
            reply = api.answer_question("What is it for?", ["DB00331"], [])
        self.assertIn("A database-grounded summary.", reply.answer)
        self.assertIn("go.drugbank.com/drugs/DB00331", reply.answer)

    def test_label_candidates_remove_dosage_and_form(self) -> None:
        self.assertIn("METFORMIN", api.candidate_names("METFORMIN HCL 500 MG TABLETS"))
        self.assertNotIn(
            "500", " ".join(api.candidate_names("METFORMIN HCL 500 MG TABLETS"))
        )

    def test_food_question_uses_food_records(self) -> None:
        warfarin = {"drugbank_id": "DB00682", "name": "Warfarin"}
        with (
            patch.object(api, "get_drugs_by_ids", return_value=[warfarin]),
            patch.object(api, "names_in_question", return_value=[]),
            patch.object(
                api,
                "get_food_interactions",
                return_value=["Avoid a sudden change in vitamin K intake."],
            ) as foods,
            patch.object(api, "check_drug_interactions") as interactions,
        ):
            reply = api.answer_question(
                "What food interactions are in my list?", ["DB00682"], []
            )
        self.assertIn("vitamin K", reply.answer)
        self.assertEqual(reply.referenced_drug_ids, ["DB00682"])
        foods.assert_called_once_with("DB00682")
        interactions.assert_not_called()

    def test_named_drug_checks_against_saved_list(self) -> None:
        aspirin = {"drugbank_id": "DB00945", "name": "Aspirin"}
        warfarin = {"drugbank_id": "DB00682", "name": "Warfarin"}
        with (
            patch.object(
                api,
                "get_drugs_by_ids",
                side_effect=lambda ids: [warfarin] if ids else [],
            ),
            patch.object(api, "names_in_question", return_value=[aspirin]),
            patch.object(
                api,
                "check_drug_interactions",
                return_value=[
                    {
                        "drug_name": "Warfarin",
                        "interacting_drug_name": "Aspirin",
                        "description": "Bleeding risk may increase.",
                    }
                ],
            ) as interactions,
        ):
            reply = api.answer_question(
                "Does aspirin interact with my medications?", ["DB00682"], []
            )
        self.assertIn("Bleeding risk", reply.answer)
        self.assertEqual(set(reply.referenced_drug_ids), {"DB00682", "DB00945"})
        self.assertEqual(set(interactions.call_args.args[0]), {"DB00682", "DB00945"})


@unittest.skipUnless(
    Path(api.DB_PATH).is_file(), "Licensed DrugBank database not present"
)
class LocalDatabaseSmokeTests(unittest.TestCase):
    def test_search_scan_and_assistant_against_real_records(self) -> None:
        matches = asyncio.run(api.search_drugs("metformin"))
        self.assertEqual(matches[0].drugbank_id, "DB00331")
        scan = api.match_ocr_lines(["METFORMIN HCL", "500 MG TABLETS"])
        self.assertEqual(scan.matched_drugs[0].drugbank_id, "DB00331")
        reply = api.answer_question("Can aspirin and warfarin interact?", [], [])
        self.assertIn("Recorded interactions", reply.answer)
        self.assertIn("go.drugbank.com/drugs/DB00682", reply.answer)
