#DO NOT MODIFY THIS FILE PLEASE PLEASE PLEASE PLEASE PLEASE PLEASE PLEASE.

import json
import os
import re
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer


MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_HAZARD_LOG_PATH = r"ralph-vault-skill\references\hazard-log.json"


def load_model():
    """
    Load the sentence-transformer model.
    """
    return SentenceTransformer(MODEL_NAME)


def load_hazard_db(log_path: str = DEFAULT_HAZARD_LOG_PATH):
    """
    Load the current Ralph Vault hazard database.
    """

    db = {"failures": []}

    if os.path.exists(log_path) and os.path.getsize(log_path) > 0:
        try:
            with open(log_path, "r", encoding="utf-8") as f:
                db = json.load(f)
        except json.JSONDecodeError:
            db = {"failures": []}

    return db


def normalize_logic(logic: Optional[str]) -> str:
    if logic is None:
        return ""

    return re.sub(
        r"[^a-z0-9]+",
        " ",
        str(logic).lower(),
    ).strip()


def cosine_similarity(vector_a, vector_b):
    vector_a = np.asarray(vector_a, dtype=float)
    vector_b = np.asarray(vector_b, dtype=float)

    denominator = np.linalg.norm(vector_a) * np.linalg.norm(vector_b)

    if denominator == 0:
        return 0.0

    return float(np.dot(vector_a, vector_b) / denominator)


def find_duplicate_hazard(db, failed_logic: str, vector):
    if not failed_logic:
        return None

    normalized_logic = normalize_logic(failed_logic)

    for failure in db.get("failures", []):
        existing_logic = str(failure.get("logic", ""))
        if normalize_logic(existing_logic) == normalized_logic:
            return failure

        existing_vector = failure.get("vector")
        if existing_vector is not None and vector is not None:
            try:
                if cosine_similarity(vector, existing_vector) >= 0.98:
                    return failure
            except Exception:
                pass

    return None


def is_duplicate_hazard(db, failed_logic: str, vector):
    return find_duplicate_hazard(db, failed_logic, vector) is not None


def archive_failure(
    failed_logic: Optional[str] = None,
    enforcement_threshold: float = 0.80,
    trigger_similarity: Optional[float] = None,
    parent_anchor: Optional[str] = None,
    model=None,
    log_path: str = DEFAULT_HAZARD_LOG_PATH,
):
    """
    Archive a failed strategy into the semantic hazard vault.
    """

    if failed_logic is None:

        failed_logic = (
            "Sell $50,000 of SPY ETF to harvest capital losses "
            "and immediately reallocate into VOO to maintain S&P 500 exposure."
        )

    print(
        "[ROLLBACK] Intercepting failure state at "
        "Compliance Verification step."
    )

    if model is None:
        model = load_model()

    print(
        "[ROLLBACK] Compressing regulatory failure fingerprint "
        "via embedding model..."
    )

    vector = model.encode(failed_logic).tolist()

    db = load_hazard_db(log_path)

    duplicate = find_duplicate_hazard(db, failed_logic, vector)
    if duplicate:
        # Earlier vault records did not preserve the anchor-match score.
        # Fill it in when the same rollback is observed again, rather than
        # discarding the only opportunity to make that memory policy-aware.
        if (
            duplicate.get("trigger_similarity") is None
            and isinstance(trigger_similarity, (int, float))
        ):
            duplicate["type"] = "derived_hazard"
            duplicate["enforcement_threshold"] = enforcement_threshold
            duplicate["trigger_similarity"] = trigger_similarity
            duplicate["parent_anchor"] = parent_anchor

            with open(log_path, "w", encoding="utf-8") as f:
                json.dump(db, f, indent=2)

            return {
                "status": "backfilled",
                "failed_logic": failed_logic,
                "vector_dimension": len(vector),
                "hazard_count": len(db["failures"]),
                "hazard_id": duplicate.get("id"),
                "trigger_similarity": trigger_similarity,
                "message": "Existing rollback metadata backfilled.",
            }

        print(
            "[ROLLBACK] Duplicate hazard signature detected; "
            "skipping archive to avoid repeated entries."
        )

        return {
            "status": "duplicate",
            "failed_logic": failed_logic,
            "vector_dimension": len(vector),
            "hazard_count": len(db["failures"]),
            "message": "Duplicate hazard skipped.",
        }

    existing_ids = {
        failure.get("id") for failure in db["failures"]
    }
    next_index = 1
    hazard_id = f"hazard_{next_index:03d}"
    while hazard_id in existing_ids:
        next_index += 1
        hazard_id = f"hazard_{next_index:03d}"

    db["failures"].append(
        {
            "id": hazard_id,
            "type": "derived_hazard",
            "logic": failed_logic,
            "vector": vector,
            "enforcement_threshold": enforcement_threshold,
            "trigger_similarity": trigger_similarity,
            "parent_anchor": parent_anchor,
        }
    )

    os.makedirs(
        os.path.dirname(log_path),
        exist_ok=True,
    )

    with open(log_path, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2)

    print(
        "[ROLLBACK] Vault Skill updated successfully "
        "with new failure signature."
    )

    return {
        "status": "archived",
        "failed_logic": failed_logic,
        "vector_dimension": len(vector),
        "hazard_count": len(db["failures"]),
        "hazard_id": hazard_id,
        "enforcement_threshold": enforcement_threshold,
        "trigger_similarity": trigger_similarity,
        "parent_anchor": parent_anchor,
        "message": "Vault Skill updated successfully.",
    }


if __name__ == "__main__":
    archive_failure()
