# Ralph Semantic Rollback Demo

An interactive demonstration of an agentic workflow that checks proposed strategies against semantic compliance hazards before execution. When a strategy is blocked, the demo archives a derived rollback memory and—where available—generates a safer pivot strategy.

The project is a local demo, not a production compliance or legal-decision system.

## What it demonstrates

- A mock agent produces a plan for one of three scenarios: wash sale, AML structuring, or lending.
- The interceptor embeds the plan and compares it with anchor policies and rollback memories using cosine similarity.
- A configurable similarity cutoff (`0.50`–`0.95`) decides whether an eligible match blocks the plan.
- A blocked plan is archived in the vault and the agent can pivot to an alternative plan.
- The React UI shows the result, audit timeline, vault summary, and a 2D semantic map. The map uses MDS for visualization only; enforcement uses the original embedding-space cosine similarity.

## Architecture

```text
React + Vite UI
       |
       v
FastAPI API (/api/execute)
       |
       +--> mock agent --> proposed plan
       |
       +--> interceptor --> anchor policies + vault memories
       |                      |
       |                      +--> cosine-similarity decision
       |
       +--> rollback archive --> hazard-log.json
       |
       +--> optional pivot plan + semantic-map projection
```

### Hazard types

The interceptor searches two categories of records.

- `anchor_policy` — immutable, hardcoded policy definitions built from `backend/core/scenarios.py`. They are always eligible for evaluation.
- `derived_hazard` — a rollback memory written after a blocked plan. It preserves the context in which the memory was created.

A derived record has this shape:

```json
{
  "id": "hazard_001",
  "type": "derived_hazard",
  "logic": "Agent attempted to sell SPY and buy VOO.",
  "vector": [0.12, -0.45, 0.88],
  "enforcement_threshold": 0.73,
  "trigger_similarity": 0.78,
  "parent_anchor": "policy_wash_sale"
}
```

`enforcement_threshold` records the UI cutoff at archive time for audit purposes. `trigger_similarity` is the similarity between the original plan and its parent anchor policy, and is what controls whether the rollback memory remains relevant.

For example, a plan that matched an anchor at `0.78` and was caught with a `0.73` cutoff becomes a near-`100%` match against its derived memory on a repeat attempt. That memory is eligible while the live cutoff is `<= 0.78`; it is ignored when the cutoff is above `0.78`, because the original anchor match would no longer be a violation. This avoids stale rollback records overriding a more permissive live policy.

Historical records with `"trigger_similarity": null` are retained for audit but are not used to block until the same rollback is observed and its metadata can be backfilled.

## Prerequisites

- Python 3.10 or later
- Node.js 20 or later with npm
- Internet access on the first run so `sentence-transformers` can download `all-MiniLM-L6-v2` (unless it is already cached)

## Run locally

Open two terminals in the `demo` directory.

### 1. Start the API

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
uvicorn backend.main:app --reload
```

The API runs on <http://localhost:8000>. Interactive API documentation is available at <http://localhost:8000/docs>.

### 2. Start the UI

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite address shown in the terminal, normally <http://localhost:5173>.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/scenarios` | List the available demo scenarios. |
| `POST` | `/api/execute` | Generate, evaluate, optionally roll back, and map a strategy. |
| `GET` | `/api/vault` | Return a lightweight vault summary. |
| `GET` | `/api/vault/raw` | Return the complete persisted vault. |
| `POST` | `/api/rollback` | Archive a rollback record directly. |
| `POST` | `/api/semantic-map` | Produce the map data for a scenario. |
| `POST` | `/api/reset` | Remove local `.prune_flag` and `proposed_plan.txt` runtime state. |

Example execution request:

```json
POST /api/execute
{
  "scenario": "Wealth Management (Wash Sale)",
  "threshold": 0.73
}
```

## Project layout

```text
demo/
├── backend/
│   ├── main.py                       # FastAPI routes
│   ├── core/scenarios.py              # Immutable anchor policies and demo scenarios
│   └── services/                      # Agent, interceptor, rollback, vault, and map adapters
├── frontend/                          # React + Vite interface
├── ralph-vault-skill/references/
│   └── hazard-log.json                # Persisted derived rollback memories
├── interceptor.py                     # Cosine search and metadata-aware eligibility filter
├── rollback_engine.py                 # Derived-hazard archive and metadata backfill
└── mock_agent.py                      # Standalone mock plan generator
```

## Development checks

From `demo`:

```powershell
python -m py_compile interceptor.py rollback_engine.py backend\main.py
cd frontend
npm run lint
npm run build
```

## Runtime state and data

- `.prune_flag` and `proposed_plan.txt` are transient local runtime files and are ignored by Git.
- `ralph-vault-skill/references/hazard-log.json` is persistent demo data. Back it up before manually editing or resetting it.
- The reset endpoint does not clear the vault; it only removes transient runtime state.
