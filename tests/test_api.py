"""Focused tests for the medication workflow and grounded assistant."""

from __future__ import annotations

import asyncio
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from src import api
from src.utils.interaction_groups import group_related_warnings


def pair(left: str, right: str, description: str) -> dict[str, str]:
    return {
        "drug_id": left,
        "drug_name": left,
        "interacting_drug_id": right,
        "interacting_drug_name": right,
        "description": description,
    }


class MedicationWorkflowTests(unittest.TestCase):
    def test_warning_groups_require_two_distinct_pairs_with_specific_wording(
        self,
    ) -> None:
        records = [
            pair("A", "B", "The risk of bleeding can be increased."),
            pair("B", "A", "The risk of bleeding can be increased."),
            pair("A", "C", "Gastrointestinal bleeding can be increased."),
            pair("B", "C", "The risk of adverse effects can be increased."),
        ]
        groups = group_related_warnings(records)
        self.assertEqual([group["key"] for group in groups], ["bleeding"])
        self.assertEqual(len(groups[0]["pairs"]), 2)

    def test_warning_groups_do_not_conflate_opposite_anticoagulant_effects(
        self,
    ) -> None:
        records = [
            pair("A", "B", "May increase the anticoagulant activities of A."),
            pair("A", "C", "May decrease the anticoagulant activities of A."),
        ]
        self.assertEqual(group_related_warnings(records), [])

    def test_group_question_uses_recorded_pairs_without_model(self) -> None:
        drugs = [
            {"drugbank_id": "DB00001", "name": "A"},
            {"drugbank_id": "DB00002", "name": "B"},
            {"drugbank_id": "DB00003", "name": "C"},
        ]
        records = [
            pair("DB00001", "DB00002", "The risk of bleeding can be increased."),
            pair("DB00002", "DB00003", "The risk of bleeding can be increased."),
        ]
        with (
            patch.object(
                api, "get_drugs_by_ids", side_effect=lambda ids: drugs if ids else []
            ),
            patch.object(api, "names_in_question", return_value=[]),
            patch.object(api, "check_drug_interactions", return_value=records),
            patch.object(api, "ask_sentinel") as model,
        ):
            reply = api.answer_question(
                "What are the compounding side effects across my medications?",
                [drug["drugbank_id"] for drug in drugs],
                [],
            )
        self.assertIn("Bleeding — 2 pairs", reply.answer)
        self.assertIn("DB00001 + DB00002", reply.answer)
        self.assertIn("DB00002 + DB00003", reply.answer)
        self.assertIn("does not measure the combined effect", reply.answer)
        model.assert_not_called()

    def test_sentinel_uses_retrieved_records_and_caps_generation(self) -> None:
        drug = {"drugbank_id": "DB00331", "name": "Metformin"}
        response = Mock()
        response.json.return_value = {"message": {"content": "It treats diabetes."}}
        with (
            patch.object(
                api,
                "sentinel_context",
                return_value="DrugBank ID: DB00331\nName: Metformin",
            ),
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
            patch.object(
                api, "ask_sentinel", return_value="A database-grounded summary."
            ),
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
                        "drug_id": "DB00682",
                        "drug_name": "Warfarin",
                        "interacting_drug_id": "DB00945",
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
    def test_grouped_warnings_match_real_pair_records_and_chat(self) -> None:
        ids = ["DB00682", "DB00945", "DB00758", "DB06605", "DB01050"]
        result = asyncio.run(api.interactions(api.MedicationRequest(drug_ids=ids)))
        groups = {group["key"]: group for group in result["warning_groups"]}
        self.assertEqual(len(groups["bleeding"]["pairs"]), 3)
        self.assertEqual(len(groups["anticoagulant_increase"]["pairs"]), 2)
        reply = api.answer_question(
            "What shared warnings appear across my medications?", ids, []
        )
        self.assertIn("Bleeding — 3 pairs", reply.answer)
        self.assertIn("Increased anticoagulant activity — 2 pairs", reply.answer)

    def test_search_scan_and_assistant_against_real_records(self) -> None:
        matches = asyncio.run(api.search_drugs("metformin"))
        self.assertEqual(matches[0].drugbank_id, "DB00331")
        scan = api.match_ocr_lines(["METFORMIN HCL", "500 MG TABLETS"])
        self.assertEqual(scan.matched_drugs[0].drugbank_id, "DB00331")
        reply = api.answer_question("Can aspirin and warfarin interact?", [], [])
        self.assertIn("Recorded interactions", reply.answer)
        self.assertIn("go.drugbank.com/drugs/DB00682", reply.answer)
