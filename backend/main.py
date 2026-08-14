from typing import Optional
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend.core.scenarios import SCENARIOS
from backend.services.agent_service import run_agent
from backend.services.interceptor_service import run_interceptor
from backend.services.rollback_service import run_rollback
from backend.services.vault_service import get_vault, get_vault_summary
from backend.services.semantic_map_service import (
    build_semantic_map,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]


app = FastAPI(
    title="Ralph Semantic Rollback API",
    description="Backend API for the Ralph semantic rollback demonstration.",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ExecuteRequest(BaseModel):
    scenario: str
    threshold: float = Field(
        default=0.80,
        ge=0.50,
        le=0.95,
    )


class RollbackRequest(BaseModel):
    failed_logic: str
    enforcement_threshold: float = Field(default=0.80, ge=0.50, le=0.95)
    trigger_similarity: Optional[float] = Field(default=None, ge=-1, le=1)
    parent_anchor: Optional[str] = None


@app.get("/")
def root():
    return {
        "name": "Ralph Semantic Rollback API",
        "status": "online",
    }


@app.get("/api/scenarios")
def list_scenarios():
    return {
        "scenarios": [
            {
                "name": name,
                **data,
            }
            for name, data in SCENARIOS.items()
        ]
    }


@app.get("/api/vault")
def vault():
    return get_vault_summary()


@app.get("/api/vault/raw")
def vault_raw():
    return get_vault()


@app.post("/api/execute")
def execute_strategy(request: ExecuteRequest):

    if request.scenario not in SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario: {request.scenario}",
        )

    scenario = SCENARIOS[request.scenario]

    # ---------------------------------------------------------
    # PHASE 1 — MOCK AGENT
    # ---------------------------------------------------------

    agent_result = run_agent(
        scenario=request.scenario,
        prune_flag=False,
    )

    proposed_plan = agent_result["plan"]

    # ---------------------------------------------------------
    # PHASE 2 — SEMANTIC INTERCEPTOR
    # ---------------------------------------------------------

    interceptor_result = run_interceptor(
        proposed_plan=proposed_plan,
        threshold=request.threshold,
    )

    # ---------------------------------------------------------
    # PHASE 3 — SEMANTIC ROLLBACK
    # ---------------------------------------------------------

    rollback_result: Optional[dict] = None
    pivot_result: Optional[dict] = None
    pivot_plan = None

    if (
        interceptor_result["blocked"]
        and scenario["pivot_plan"] != "N/A"
    ):

        rollback_result = run_rollback(
            failed_logic=proposed_plan,
            enforcement_threshold=request.threshold,
            trigger_similarity=interceptor_result.get("similarity"),
            parent_anchor=(
                interceptor_result.get("parent_anchor")
                or interceptor_result.get("matched_hazard_id")
            ),
        )

        pivot_result = run_agent(
            scenario=request.scenario,
            prune_flag=True,
        )

        if pivot_result:
            pivot_plan = pivot_result.get("plan")

    semantic_map = build_semantic_map(
        proposed_plan=proposed_plan,
        pivot_plan=pivot_plan,
        matched_hazard=(
            interceptor_result.get("matched_hazard")
        ),
        threshold=request.threshold,
    )

    return {
        "scenario": {
            "name": request.scenario,
            **scenario,
        },
        "threshold": request.threshold,
        "agent": agent_result,
        "interceptor": interceptor_result,
        "rollback": rollback_result,
        "pivot": pivot_result,
        "vault": get_vault_summary(),
        "semantic_map": semantic_map,
    }


@app.post("/api/rollback")
def rollback(request: RollbackRequest):

    if not request.failed_logic.strip():
        raise HTTPException(
            status_code=400,
            detail="failed_logic cannot be empty.",
        )

    result = run_rollback(
        failed_logic=request.failed_logic,
        enforcement_threshold=request.enforcement_threshold,
        trigger_similarity=request.trigger_similarity,
        parent_anchor=request.parent_anchor,
    )

    return {
        "rollback": result,
        "vault": get_vault_summary(),
    }


@app.post("/api/reset")
def reset_state():

    removed = []

    prune_flag = PROJECT_ROOT / ".prune_flag"
    proposed_plan = PROJECT_ROOT / "proposed_plan.txt"

    for path in [
        prune_flag,
        proposed_plan,
    ]:

        if path.exists():
            path.unlink()
            removed.append(path.name)

    return {
        "status": "reset",
        "removed": removed,
    }

@app.post("/api/semantic-map")
def semantic_map(
    request: ExecuteRequest,
):
    if request.scenario not in SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario: {request.scenario}",
        )

    scenario = SCENARIOS[
        request.scenario
    ]

    agent_result = run_agent(
        scenario=request.scenario,
        prune_flag=False,
    )

    proposed_plan = agent_result["plan"]

    interceptor_result = run_interceptor(
        proposed_plan=proposed_plan,
        threshold=request.threshold,
    )

    pivot_plan = None

    if (
        interceptor_result["blocked"]
        and scenario["pivot_plan"] != "N/A"
    ):
        pivot_plan = scenario["pivot_plan"]

    return build_semantic_map(
        proposed_plan=proposed_plan,
        pivot_plan=pivot_plan,
        matched_hazard=(
            interceptor_result
            .get("matched_hazard")
        ),
        threshold=request.threshold,
    )
