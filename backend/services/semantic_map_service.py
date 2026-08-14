from functools import lru_cache
from pathlib import Path
from typing import Optional

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.manifold import MDS

from backend.services.interceptor_service import (
    build_scenario_hazard_db,
    merge_hazard_databases,
)
from interceptor import load_hazard_db


MODEL_NAME = "all-MiniLM-L6-v2"
HAZARD_LOG_PATH = (
    Path(__file__).resolve().parents[2]
    / "ralph-vault-skill"
    / "references"
    / "hazard-log.json"
)


@lru_cache(maxsize=1)
def get_model():
    """Load the sentence transformer once and reuse it."""
    return SentenceTransformer(MODEL_NAME)


def cosine_distance(vector_a, vector_b):
    """Calculate cosine distance = 1 - cosine similarity."""
    vector_a = np.asarray(vector_a)
    vector_b = np.asarray(vector_b)

    denominator = np.linalg.norm(vector_a) * np.linalg.norm(vector_b)
    if denominator == 0:
        return 1.0

    similarity = np.dot(vector_a, vector_b) / denominator
    return float(1.0 - similarity)


def build_hazard_corpus(model):
    """Use the exact canonical+vault hazard corpus as the interceptor."""
    scenario_db = build_scenario_hazard_db(model)
    vault_db = load_hazard_db(str(HAZARD_LOG_PATH))
    merged_db = merge_hazard_databases(scenario_db, vault_db)

    hazards = []
    for index, failure in enumerate(merged_db.get("failures", [])):
        hazards.append(
            {
                "id": failure.get("id", f"legacy-hazard-{index}"),
                "type": failure.get("type", "legacy_hazard"),
                "label": failure.get("logic", f"Hazard {index + 1}"),
                "logic": failure.get("hazard_logic", failure.get("logic", "")),
                "source": failure.get("source", "vault"),
                "enforcement_threshold": failure.get(
                    "enforcement_threshold"
                ),
                "trigger_similarity": failure.get("trigger_similarity"),
                "parent_anchor": failure.get("parent_anchor"),
            }
        )

    return hazards


def normalize_coordinates(coordinates):
    """Normalize MDS coordinates into percentages suitable for the React UI."""
    coordinates = np.asarray(coordinates)

    x = coordinates[:, 0]
    y = coordinates[:, 1]

    x_min, x_max = x.min(), x.max()
    y_min, y_max = y.min(), y.max()

    x_range = x_max - x_min
    y_range = y_max - y_min

    if x_range == 0:
        x_range = 1.0
    if y_range == 0:
        y_range = 1.0

    normalized_x = ((x - x_min) / x_range)
    normalized_y = ((y - y_min) / y_range)

    normalized_x = normalized_x * 84 + 8
    normalized_y = normalized_y * 84 + 8

    return normalized_x, normalized_y


def build_semantic_map(
    proposed_plan: str,
    pivot_plan: Optional[str] = None,
    matched_hazard: Optional[str] = None,
    threshold: float = 0.80,
):
    """Create the 2D semantic visualization aligned with the interceptor."""
    model = get_model()
    hazards = build_hazard_corpus(model)

    hazard_vectors = [model.encode(hazard["logic"]) for hazard in hazards]
    proposed_vector = model.encode(proposed_plan)

    has_pivot = pivot_plan is not None and pivot_plan != "N/A"
    pivot_vector = None
    if has_pivot:
        pivot_vector = model.encode(pivot_plan)

    vectors = list(hazard_vectors)
    proposed_index = len(vectors)
    vectors.append(proposed_vector)

    pivot_index = None
    if has_pivot:
        pivot_index = len(vectors)
        vectors.append(pivot_vector)

    vectors = np.asarray(vectors)
    count = len(vectors)

    distance_matrix = np.zeros((count, count))
    for i in range(count):
        for j in range(count):
            distance_matrix[i, j] = cosine_distance(vectors[i], vectors[j])

    mds = MDS(
        n_components=2,
        dissimilarity="precomputed",
        random_state=42,
        n_init=4,
    )
    reduced = mds.fit_transform(distance_matrix)
    normalized_x, normalized_y = normalize_coordinates(reduced)

    # MDS is an approximate 2D projection. Keep exact semantic matches
    # visually exact as well, so a 100% similarity renders as overlapping
    # points instead of a small projection artefact.
    for index, hazard_vector in enumerate(hazard_vectors):
        similarity = 1.0 - cosine_distance(proposed_vector, hazard_vector)
        if np.isclose(similarity, 1.0, atol=1e-6):
            normalized_x[proposed_index] = normalized_x[index]
            normalized_y[proposed_index] = normalized_y[index]
            break

    matched_index = None
    if matched_hazard:
        for index, hazard in enumerate(hazards):
            if hazard["label"] == matched_hazard:
                matched_index = index
                break

    nodes = []
    for index, hazard in enumerate(hazards):
        nodes.append(
            {
                "id": hazard["id"],
                "type": "hazard",
                "label": hazard["label"],
                "logic": hazard["logic"],
                "source": hazard["source"],
                "hazard_type": hazard["type"],
                "enforcement_threshold": hazard["enforcement_threshold"],
                "trigger_similarity": hazard["trigger_similarity"],
                "parent_anchor": hazard["parent_anchor"],
                "x": float(normalized_x[index]),
                "y": float(normalized_y[index]),
                "matched": index == matched_index,
            }
        )

    nodes.append(
        {
            "id": "proposed",
            "type": "proposed",
            "label": "Proposed Strategy",
            "logic": proposed_plan,
            "source": "execution",
            "x": float(normalized_x[proposed_index]),
            "y": float(normalized_y[proposed_index]),
            "matched": False,
        }
    )

    if pivot_index is not None:
        nodes.append(
            {
                "id": "pivot",
                "type": "pivot",
                "label": "Pivot Strategy",
                "logic": pivot_plan,
                "source": "execution",
                "x": float(normalized_x[pivot_index]),
                "y": float(normalized_y[pivot_index]),
                "matched": False,
            }
        )

    hazard_similarities = []
    for index, hazard_vector in enumerate(hazard_vectors):
        distance = cosine_distance(proposed_vector, hazard_vector)
        similarity = 1.0 - distance
        hazard_similarities.append(
            {
                "hazard_id": hazards[index]["id"],
                "label": hazards[index]["label"],
                "similarity": float(similarity),
                "distance": float(distance),
            }
        )

    hazard_similarities.sort(key=lambda item: item["similarity"], reverse=True)

    return {
        "nodes": nodes,
        "hazard_similarities": hazard_similarities,
        "matched_hazard": matched_hazard,
        "matched_index": matched_index,
        "threshold": threshold,
        "proposed_node_id": "proposed",
        "pivot_node_id": "pivot" if pivot_index is not None else None,
    }
