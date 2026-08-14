import json
import os
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer

MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_THRESHOLD = 0.80
DEFAULT_HAZARD_LOG_PATH = (
    r"ralph-vault-skill\references\hazard-log.json"
)


def load_model():
    """
    Load the sentence-transformer model.
    """
    return SentenceTransformer(MODEL_NAME)


def load_hazard_db(
    log_path: str = DEFAULT_HAZARD_LOG_PATH,
):
    """
    Load the persisted Ralph Vault.
    """

    hazard_db = {
        "failures": []
    }

    if (
        os.path.exists(log_path)
        and os.path.getsize(log_path) > 0
    ):
        try:
            with open(
                log_path,
                "r",
                encoding="utf-8",
            ) as f:
                hazard_db = json.load(f)

        except json.JSONDecodeError:
            hazard_db = {
                "failures": []
            }

    return hazard_db


def cosine_similarity(
    vector_a,
    vector_b,
):
    """
    Calculate cosine similarity.
    """

    denominator = (
        np.linalg.norm(vector_a)
        * np.linalg.norm(vector_b)
    )

    if denominator == 0:
        return 0.0

    return float(
        np.dot(vector_a, vector_b)
        / denominator
    )


def is_hazard_active(failure, live_threshold: float):
    """Return whether a matched hazard applies under the live policy."""

    hazard_type = failure.get("type", "legacy_hazard")

    if hazard_type == "anchor_policy":
        return True, None

    if hazard_type != "derived_hazard":
        return False, "missing hazard type or enforcement threshold"

    if not failure.get("parent_anchor"):
        return False, "missing parent anchor"

    trigger_similarity = failure.get("trigger_similarity")
    if not isinstance(trigger_similarity, (int, float)):
        return False, "missing trigger similarity"

    # A derived rollback represents an anchor-policy violation at this exact
    # semantic similarity. The rollback itself will compare at ~100% later,
    # but it is only relevant while the live cutoff would still catch the
    # original anchor-policy match.
    if live_threshold > float(trigger_similarity):
        return False, (
            f"triggered at {trigger_similarity:.2f}; live threshold "
            f"{live_threshold:.2f} is more permissive"
        )

    return True, None


def check_for_cycles(
    proposed_plan: Optional[str] = None,
    threshold: float = DEFAULT_THRESHOLD,
    model=None,
    log_path: str = DEFAULT_HAZARD_LOG_PATH,
    hazard_db=None,
):
    """
    Run semantic lookahead against the supplied hazard database.

    If hazard_db is not provided, the persisted Vault is loaded.

    The function returns the strongest semantic match.
    """

    if proposed_plan is None:

        if not os.path.exists(
            "proposed_plan.txt"
        ):
            return {
                "status": "error",
                "blocked": False,
                "message": (
                    "No proposed_plan.txt found."
                ),
                "similarity": 0.0,
                "matched_hazard": None,
                "matched_failure_logic": None,
                "threshold": threshold,
                "prune_flag_created": False,
            }

        with open(
            "proposed_plan.txt",
            "r",
            encoding="utf-8",
        ) as f:
            proposed_plan = f.read().strip()

    if hazard_db is None:
        hazard_db = load_hazard_db(
            log_path
        )

    if model is None:
        model = load_model()

    current_vector = model.encode(
        proposed_plan
    )

    if not hazard_db.get("failures"):
        return {
            "status": "cleared",
            "blocked": False,
            "message": (
                "No semantic hazards available."
            ),
            "similarity": 0.0,
            "matched_hazard": None,
            "matched_failure_logic": None,
            "threshold": threshold,
            "prune_flag_created": False,
        }

    max_similarity = -1.0
    matched_failure = None
    ignored_derived_hazards = []

    print(
        "[INTERCEPTOR] Running semantic "
        "lookahead search against Vault..."
    )

    for failure in (
        hazard_db["failures"]
    ):

        past_vector = np.array(
            failure["vector"]
        )

        similarity = cosine_similarity(
            current_vector,
            past_vector,
        )

        print(
            " -> Semantic Similarity Signature "
            f"score: {similarity:.4f}"
        )

        is_active, inactive_reason = is_hazard_active(
            failure,
            threshold,
        )

        if not is_active:
            if similarity > threshold:
                ignored_derived_hazards.append(
                    {
                        "id": failure.get("id"),
                        "logic": failure.get("logic"),
                        "similarity": similarity,
                        "reason": inactive_reason,
                    }
                )
            continue

        if similarity > max_similarity:
            max_similarity = similarity
            matched_failure = failure

    matched_hazard = (
        matched_failure.get("logic")
        if matched_failure else None
    )
    matched_failure_logic = (
        matched_failure.get(
            "hazard_logic",
            matched_failure.get("logic"),
        )
        if matched_failure else None
    )
    matched_hazard_id = (
        matched_failure.get("id")
        if matched_failure else None
    )
    matched_hazard_type = (
        matched_failure.get("type", "legacy_hazard")
        if matched_failure else None
    )
    parent_anchor = (
        matched_failure.get("parent_anchor")
        if matched_failure else None
    )

    blocked = (
        max_similarity > threshold
    )

    if blocked:

        print(
            "\n[!!! INTERCEPTOR "
            "COMPLIANCE BLOCK !!!]"
        )

        print(
            "Regulatory failure match detected "
            f"({max_similarity:.2%} confidence)."
        )

        print(
            "Reason: Logic mirrors past failure: "
            f"'{matched_hazard}'"
        )

        print(
            "Action: Semantic Pruning triggered."
        )

        with open(
            ".prune_flag",
            "w",
            encoding="utf-8",
        ) as flag:
            flag.write("TRUE")

        return {
            "status": "blocked",
            "blocked": True,
            "message": (
                "Compliance block triggered."
            ),
            "similarity": max_similarity,
            "matched_hazard": matched_hazard,
            "matched_failure_logic": (
                matched_failure_logic
            ),
            "matched_hazard_id": matched_hazard_id,
            "matched_hazard_type": matched_hazard_type,
            "parent_anchor": parent_anchor,
            "ignored_derived_hazards": ignored_derived_hazards,
            "threshold": threshold,
            "prune_flag_created": True,
        }

    print(
        "[INTERCEPTOR] Route cleared. "
        "No regulatory conflicts detected."
    )

    return {
        "status": "cleared",
        "blocked": False,
        "message": (
            "Route cleared. No regulatory "
            "conflicts detected."
        ),
        "similarity": max_similarity,
        "matched_hazard": matched_hazard,
        "matched_failure_logic": (
            matched_failure_logic
        ),
        "matched_hazard_id": matched_hazard_id,
        "matched_hazard_type": matched_hazard_type,
        "parent_anchor": parent_anchor,
        "ignored_derived_hazards": ignored_derived_hazards,
        "threshold": threshold,
        "prune_flag_created": False,
    }


if __name__ == "__main__":
    check_for_cycles()
