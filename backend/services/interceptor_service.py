import sys
from pathlib import Path

from backend.core.scenarios import SCENARIOS

PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from interceptor import (
    check_for_cycles,
    load_hazard_db,
    load_model,
)


def build_scenario_hazard_db(model):
    """
    Build the canonical scenario hazard corpus.

    These hazards exist even when the persistent Vault
    is empty.
    """

    failures = []

    for (
        scenario_name,
        scenario,
    ) in SCENARIOS.items():

        vector = model.encode(
            scenario["hazard_logic"]
        ).tolist()

        failures.append(
            {
                "id": scenario["policy_id"],
                "type": "anchor_policy",
                "logic": scenario[
                    "hazard_name"
                ],
                "hazard_logic": scenario[
                    "hazard_logic"
                ],
                "scenario": scenario_name,
                "source": "scenario",
                "vector": vector,
            }
        )

    return {
        "failures": failures
    }


def merge_hazard_databases(
    scenario_db,
    vault_db,
):
    """
    Combine canonical scenario hazards and
    persisted Vault failures without duplicates.
    """

    merged = {
        "failures": []
    }

    seen = set()

    for failure in (
        scenario_db.get(
            "failures",
            []
        )
        + vault_db.get(
            "failures",
            []
        )
    ):

        logic = failure.get("logic")

        if not logic:
            continue

        # IDs distinguish policies from derived rollback memories; logic is
        # only a fallback for pre-schema vault entries.
        hazard_id = failure.get("id", logic)
        if hazard_id in seen:
            continue

        seen.add(hazard_id)

        merged["failures"].append(
            failure
        )

    return merged


def run_interceptor(
    proposed_plan: str,
    threshold: float = 0.80,
    model=None,
):
    """
    Run semantic interception against:

    1. Canonical scenario hazards
    2. Persistent Ralph Vault failures
    """

    if model is None:
        model = load_model()

    scenario_db = (
        build_scenario_hazard_db(
            model
        )
    )

    vault_path = (
        PROJECT_ROOT
        / "ralph-vault-skill"
        / "references"
        / "hazard-log.json"
    )

    vault_db = load_hazard_db(
        str(vault_path)
    )

    hazard_db = (
        merge_hazard_databases(
            scenario_db,
            vault_db,
        )
    )

    return check_for_cycles(
        proposed_plan=proposed_plan,
        threshold=threshold,
        model=model,
        hazard_db=hazard_db,
        log_path=str(vault_path),
    )
