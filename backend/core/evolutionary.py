"""
Evolutionary Algorithm for ArchAI Design Generation.

Process:
1. Generate N initial DNA variants (population)
2. Score each variant for fitness
3. Select top K survivors
4. Breed survivors via crossover + mutation to create next generation
5. Repeat for G generations with elitism to preserve top performers
6. Enforce phenotypic diversity in final selection
7. Return the top 5 variants for user selection

Architecture:
- Elitism: Top 2 survivors always carry forward unchanged
- Crossover: Pairs of survivors breed new individuals
- Mutation: All offspring mutate at configurable rate
- Diversity: Final selection rejects duplicates by style+form key
- Memory: Updates global_memory_store to prevent cross-session repetition
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict
from typing import Callable, List, Optional, TypedDict

from core.design_dna import (
    DesignDNA,
    crossover_dna,
    dna_similarity,
    ensure_uniqueness,
    express_dna,
    generate_seed,
    global_memory_store,
    mutate_dna,
    score_dna,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal type alias for population members
# ---------------------------------------------------------------------------

class Individual(TypedDict, total=False):
    dna: DesignDNA
    score: float
    generation: int
    parent_id: Optional[str]          # set for offspring
    parent_ids: Optional[list[str]]   # set for crossover children
    lineage: str                       # "genesis" | "survivor" | "crossover" | "mutant"


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _make_individual(
    dna: DesignDNA,
    score: float,
    generation: int,
    lineage: str = "genesis",
    parent_id: Optional[str] = None,
    parent_ids: Optional[list[str]] = None,
) -> Individual:
    ind: Individual = {
        "dna": dna,
        "score": score,
        "generation": generation,
        "lineage": lineage,
    }
    if parent_id is not None:
        ind["parent_id"] = parent_id
    if parent_ids is not None:
        ind["parent_ids"] = parent_ids
    return ind


def _diversity_key(ind: Individual) -> str:
    """Coarse phenotypic key used for final diversity filtering."""
    dna = ind["dna"]
    return f"{dna.primary_style}|{dna.building_form}|{dna.roof_form}"


# ---------------------------------------------------------------------------
# Main evolutionary entry-point
# ---------------------------------------------------------------------------

async def evolve_designs(
    plot_area: float,
    floors: int,
    budget: int,
    style_prefs: list[str],
    geo_data: dict,
    progress_callback: Callable = None,
    population_size: int = 12,
    generations: int = 3,
    survivors_per_gen: int = 4,
    final_variants: int = 5,
    memory_store: list[str] = [],
    elite_count: int = 2,
    crossover_rate: float = 0.5,
    mutation_rate: float = 0.25,
) -> list[dict]:
    """
    Run a full evolutionary algorithm and return the top design variants.

    Args:
        plot_area:          Site area in square metres.
        floors:             Number of floors.
        budget:             Budget in INR.
        style_prefs:        User-supplied architectural style keywords.
        geo_data:           Geographic & environmental data dict.
        progress_callback:  Async callable that receives progress dicts.
        population_size:    Number of individuals per generation.
        generations:        Number of evolutionary cycles after Gen-0.
        survivors_per_gen:  How many parents are selected each generation.
        final_variants:     How many diverse variants to return.
        memory_store:       Prior DNA signatures to discourage repetition.
        elite_count:        Number of top individuals carried forward unchanged (elitism).
        crossover_rate:     Fraction of offspring slots filled by crossover vs pure mutation.
        mutation_rate:      Per-gene mutation probability applied to offspring.

    Returns:
        List of dicts, each containing:
            - dna        : DesignDNA dataclass instance
            - dna_dict   : serialisable dict representation
            - score      : float fitness score
            - generation : int generation born in
            - lineage    : how this individual was created
            - rank       : 1-indexed rank in final selection
            - characteristics: human-readable trait summary
    """

    run_start = time.perf_counter()
    history: list[dict] = []  # tracks per-generation stats for summary

    # -----------------------------------------------------------------------
    # GENERATION 0 — Genesis Population
    # -----------------------------------------------------------------------
    population: list[Individual] = []

    for i in range(population_size):
        seed = generate_seed(
            geo_data.get("latitude", 0.0),
            geo_data.get("longitude", 0.0),
            plot_area,
            budget,
            style_prefs,
            extra_entropy=f"genesis_{i}",
        )
        dna = express_dna(seed, plot_area, floors, budget, style_prefs, geo_data, memory_store)
        fitness = score_dna(dna, geo_data, budget)
        ind = _make_individual(dna, fitness, generation=0, lineage="genesis")
        population.append(ind)

        if progress_callback:
            await progress_callback({
                "stage": "evolution",
                "generation": 0,
                "individual": i,
                "total_in_generation": population_size,
                "message": f"Generating design variant {i + 1}/{population_size}",
            })

    history.append(_generation_stats(population, gen=0))
    logger.debug("Gen 0 complete — best=%.1f, avg=%.1f", history[-1]["best"], history[-1]["avg"])

    # -----------------------------------------------------------------------
    # EVOLUTIONARY LOOP — Generations 1 … G
    # -----------------------------------------------------------------------
    for gen in range(1, generations + 1):
        # --- Selection: rank population, keep survivors ---
        population.sort(key=lambda x: x["score"], reverse=True)
        survivors: list[Individual] = population[:survivors_per_gen]

        if progress_callback:
            await progress_callback({
                "stage": "evolution",
                "generation": gen,
                "message": (
                    f"Generation {gen}/{generations}: "
                    f"top score = {survivors[0]['score']:.1f}"
                ),
            })

        # --- Elitism: carry top-N forward unchanged ---
        elite: list[Individual] = []
        for e_ind in survivors[:elite_count]:
            elite_copy = _make_individual(
                e_ind["dna"], e_ind["score"],
                generation=gen, lineage="survivor",
                parent_id=e_ind["dna"].dna_id,
            )
            elite.append(elite_copy)

        # --- Breeding: fill remaining slots with crossover + mutation ---
        offspring: list[Individual] = []
        slots = population_size - elite_count
        crossover_slots = int(slots * crossover_rate)
        mutation_slots = slots - crossover_slots

        # Crossover offspring — pair survivors round-robin
        for slot in range(crossover_slots):
            p1 = survivors[slot % survivors_per_gen]
            p2 = survivors[(slot + 1) % survivors_per_gen]
            child_dna = crossover_dna(p1["dna"], p2["dna"])
            # Light mutation on top of crossover
            child_dna = mutate_dna(child_dna, mutation_rate=mutation_rate * 0.5)
            child_score = score_dna(child_dna, geo_data, budget)
            offspring.append(_make_individual(
                child_dna, child_score,
                generation=gen, lineage="crossover",
                parent_ids=[p1["dna"].dna_id, p2["dna"].dna_id],
            ))

        # Pure mutation offspring
        for slot in range(mutation_slots):
            parent = survivors[slot % survivors_per_gen]
            child_dna = mutate_dna(parent["dna"], mutation_rate=mutation_rate)
            child_score = score_dna(child_dna, geo_data, budget)
            offspring.append(_make_individual(
                child_dna, child_score,
                generation=gen, lineage="mutant",
                parent_id=parent["dna"].dna_id,
            ))

        population = elite + offspring
        history.append(_generation_stats(population, gen=gen))
        logger.debug(
            "Gen %d complete — best=%.1f, avg=%.1f, elite=%d, offspring=%d",
            gen, history[-1]["best"], history[-1]["avg"], len(elite), len(offspring),
        )

    # -----------------------------------------------------------------------
    # FINAL SELECTION — diversity-aware top-K
    # -----------------------------------------------------------------------
    population.sort(key=lambda x: x["score"], reverse=True)

    selected: list[Individual] = []
    seen_keys: set[str] = set()

    # First pass: strict diversity (unique style+form+roof key)
    for candidate in population:
        key = _diversity_key(candidate)
        if key not in seen_keys:
            selected.append(candidate)
            seen_keys.add(key)
        if len(selected) >= final_variants:
            break

    # Second pass: loosen constraint to style+form only (allow roof duplicates)
    if len(selected) < final_variants:
        seen_loose: set[str] = {
            f"{ind['dna'].primary_style}|{ind['dna'].building_form}"
            for ind in selected
        }
        for candidate in population:
            if candidate in selected:
                continue
            loose_key = f"{candidate['dna'].primary_style}|{candidate['dna'].building_form}"
            if loose_key not in seen_loose:
                selected.append(candidate)
                seen_loose.add(loose_key)
            if len(selected) >= final_variants:
                break

    # Safety pad — fill with next best regardless of diversity
    pool_ids = {id(ind) for ind in selected}
    for candidate in population:
        if id(candidate) not in pool_ids:
            selected.append(candidate)
            pool_ids.add(id(candidate))
        if len(selected) >= final_variants:
            break

    # Trim to exactly final_variants
    selected = selected[:final_variants]

    # -----------------------------------------------------------------------
    # Ensure uniqueness against global memory store
    # -----------------------------------------------------------------------
    finalised: list[Individual] = []
    for ind in selected:
        unique_dna = ensure_uniqueness(
            ind["dna"],
            global_memory_store.full_dnas,
            similarity_threshold=0.72,
        )
        if unique_dna is not ind["dna"]:
            # Uniqueness enforcement mutated the dna — re-score
            ind = _make_individual(
                unique_dna,
                score_dna(unique_dna, geo_data, budget),
                generation=ind["generation"],
                lineage=ind.get("lineage", "mutant"),
            )
        global_memory_store.add_dna(ind["dna"])
        finalised.append(ind)

    # Re-sort after potential re-scoring
    finalised.sort(key=lambda x: x["score"], reverse=True)

    # -----------------------------------------------------------------------
    # Build rich output payload
    # -----------------------------------------------------------------------
    run_elapsed = time.perf_counter() - run_start
    evolution_summary = _build_summary(history, run_elapsed, population_size, generations)

    output: list[dict] = []
    for rank, ind in enumerate(finalised, start=1):
        dna = ind["dna"]
        output_item: dict = {
            # Core data
            "dna": dna,
            "dna_dict": asdict(dna),
            "score": ind["score"],
            # Provenance
            "generation": ind["generation"],
            "lineage": ind.get("lineage", "unknown"),
            "rank": rank,
            # Human-readable traits
            "characteristics": _describe_dna(dna),
            # Evolutionary context
            "evolution_summary": evolution_summary,
        }
        # Forward optional parent info if present
        if "parent_id" in ind:
            output_item["parent_id"] = ind["parent_id"]
        if "parent_ids" in ind:
            output_item["parent_ids"] = ind["parent_ids"]

        output.append(output_item)

    if progress_callback:
        await progress_callback({
            "stage": "complete",
            "message": f"Evolution complete — {final_variants} variants selected",
            "top_score": output[0]["score"],
            "elapsed_seconds": round(run_elapsed, 2),
        })

    return output


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _generation_stats(population: list[Individual], gen: int) -> dict:
    """Compute per-generation statistics for the summary."""
    scores = [ind["score"] for ind in population]
    return {
        "generation": gen,
        "size": len(population),
        "best": max(scores),
        "worst": min(scores),
        "avg": sum(scores) / len(scores) if scores else 0.0,
    }


def _build_summary(
    history: list[dict],
    elapsed: float,
    population_size: int,
    generations: int,
) -> dict:
    """Build a concise evolution summary dict for the API response."""
    return {
        "total_individuals_evaluated": population_size * (generations + 1),
        "generations_run": generations,
        "elapsed_seconds": round(elapsed, 3),
        "score_progression": [
            {"generation": h["generation"], "best": h["best"], "avg": round(h["avg"], 2)}
            for h in history
        ],
        "improvement": (
            round(history[-1]["best"] - history[0]["best"], 2)
            if len(history) >= 2 else 0.0
        ),
    }


def _describe_dna(dna: DesignDNA) -> dict:
    """
    Produce a concise, human-readable characteristics summary
    suitable for display in the frontend cards.
    """
    # Style label
    primary = dna.primary_style.replace("_", " ").title()
    secondary = dna.secondary_style.replace("_", " ").title()
    blend_pct = int(dna.style_blend_ratio * 100)
    style_label = (
        f"{primary} ({100 - blend_pct}%) + {secondary} ({blend_pct}%)"
        if 0.2 <= dna.style_blend_ratio <= 0.8
        else primary
    )

    # Sustainability indicators
    sustainability_flags: list[str] = []
    if dna.courtyard_presence:
        sustainability_flags.append("Natural courtyard cooling")
    if dna.rooftop_utility == "solar_farm":
        sustainability_flags.append("Rooftop solar")
    if dna.natural_ventilation_strategy == "cross_ventilation":
        sustainability_flags.append("Cross-ventilation")
    if dna.facade_material_palette == "sustainable_green":
        sustainability_flags.append("Sustainable materials")

    # Space highlights
    highlights: list[str] = []
    if dna.double_height_presence:
        highlights.append("Double-height spaces")
    if dna.open_plan_ratio > 0.65:
        highlights.append("Open-plan layout")
    if dna.window_wall_ratio > 0.55:
        highlights.append("High glazing ratio")

    return {
        "style_label": style_label,
        "primary_style": primary,
        "secondary_style": secondary,
        "building_form": dna.building_form.replace("_", " ").title(),
        "roof_form": dna.roof_form.replace("_", " ").title(),
        "facade_pattern": dna.facade_pattern.replace("_", " ").title(),
        "facade_palette": dna.facade_material_palette.replace("_", " ").title(),
        "floor_height_m": dna.floor_height,
        "built_up_area_sqm": round(dna.built_up_area, 1),
        "solar_orientation_deg": round(dna.solar_orientation, 1),
        "ventilation": dna.natural_ventilation_strategy.replace("_", " ").title(),
        "window_wall_ratio_pct": int(dna.window_wall_ratio * 100),
        "open_plan_pct": int(dna.open_plan_ratio * 100),
        "sustainability": sustainability_flags,
        "highlights": highlights,
        "dna_signature": dna.get_signature(),
        "mutation_factor": round(dna.mutation_factor, 3),
    }
