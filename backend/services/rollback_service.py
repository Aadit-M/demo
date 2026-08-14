import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


from rollback_engine import archive_failure


def run_rollback(
    failed_logic: str,
    enforcement_threshold: float = 0.80,
    trigger_similarity: float | None = None,
    parent_anchor: str | None = None,
    model=None,
):
    """
    Backend-facing wrapper around rollback_engine.py.
    """

    hazard_log = (
        PROJECT_ROOT
        / "ralph-vault-skill"
        / "references"
        / "hazard-log.json"
    )

    return archive_failure(
        failed_logic=failed_logic,
        enforcement_threshold=enforcement_threshold,
        trigger_similarity=trigger_similarity,
        parent_anchor=parent_anchor,
        model=model,
        log_path=str(hazard_log),
    )
