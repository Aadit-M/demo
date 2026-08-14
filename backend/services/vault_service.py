import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

HAZARD_LOG_PATH = (
    PROJECT_ROOT
    / "ralph-vault-skill"
    / "references"
    / "hazard-log.json"
)


def get_vault():
    """
    Return the current semantic hazard vault.
    """

    if not HAZARD_LOG_PATH.exists():
        return {
            "failures": []
        }

    if HAZARD_LOG_PATH.stat().st_size == 0:
        return {
            "failures": []
        }

    try:
        with open(
            HAZARD_LOG_PATH,
            "r",
            encoding="utf-8",
        ) as f:
            return json.load(f)

    except json.JSONDecodeError:
        return {
            "failures": []
        }


def get_vault_summary():
    """
    Return lightweight Vault metadata for the UI.
    """

    vault = get_vault()

    failures = vault.get("failures", [])

    return {
        "hazard_count": len(failures),
        "hazards": [
            {
                "index": index,
                "id": failure.get("id"),
                "type": failure.get("type", "legacy_hazard"),
                "logic": failure.get("logic"),
                "enforcement_threshold": failure.get(
                    "enforcement_threshold"
                ),
                "trigger_similarity": failure.get("trigger_similarity"),
                "parent_anchor": failure.get("parent_anchor"),
                "vector_dimension": len(
                    failure.get("vector", [])
                ),
            }
            for index, failure in enumerate(failures)
        ],
    }
