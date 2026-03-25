"""
LangGraph Master Orchestrator — ArchAI
======================================
Coordinates all 6 core agents in an optimised two-phase pipeline:

  Phase 1 (sequential, each depends on previous):
    GeoAgent → DesignEvolution

  Phase 2 (parallel, all depend only on Phase 1 output):
    LayoutAgent | CostAgent | ComplianceAgent | SustainabilityAgent

LangGraph integration:
  - Imported optionally; if langgraph is not installed the `asyncio`
    fallback runs the identical logic without the graph abstraction.
  - When available, `PIPELINE` is a compiled StateGraph usable with
    `await PIPELINE.ainvoke(initial_state)`.

Always use `run_pipeline()` as the canonical entry-point — it works
with or without LangGraph and is what the FastAPI routes call.
"""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from agents.geo_agent import analyze_geo
from agents.cost_agent import estimate_costs
from agents.layout_agent import generate_layout
from agents.compliance_agent import check_compliance
from agents.sustainability_agent import analyze_sustainability
from core.evolutionary import evolve_designs

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional LangGraph import
# ---------------------------------------------------------------------------
try:
    from langgraph.graph import StateGraph, END
    _LANGGRAPH_AVAILABLE = True
    logger.info("LangGraph detected — graph pipeline enabled")
except ImportError:
    _LANGGRAPH_AVAILABLE = False
    logger.info("LangGraph not installed — using asyncio fallback pipeline")


# ---------------------------------------------------------------------------
# Pipeline state schema
# ---------------------------------------------------------------------------

class PipelineState(dict):  # TypedDict-compatible plain dict for LangGraph
    """
    Shared mutable state flowing through all agent nodes.

    Keys
    ----
    project_id          : str
    latitude            : float
    longitude           : float
    plot_area_sqm       : float
    budget_inr          : int
    floors              : int
    style_preferences   : list[str]
    geo_data            : dict | None
    design_variants     : list | None   — full enriched output from evolve_designs()
    layout_data         : dict | None
    cost_data           : dict | None
    compliance_data     : dict | None
    sustainability_data : dict | None
    current_agent       : str
    completed_agents    : list[str]
    errors              : list[str]
    progress_callback   : Callable | None
    _started_at         : float          — perf_counter timestamp
    """


# ---------------------------------------------------------------------------
# Agent node functions
# ---------------------------------------------------------------------------

async def run_geo_agent(state: PipelineState) -> PipelineState:
    """Node 1 — Geographic & site analysis (Overpass / Nominatim / Open-Meteo)."""
    await _progress(state, "geo", "running", "Analysing location, zoning, and climate…")
    try:
        geo_data = await analyze_geo(
            state["latitude"],
            state["longitude"],
            state["plot_area_sqm"],
        )
        state["geo_data"] = geo_data
        state["completed_agents"].append("geo")
        await _progress(
            state, "geo", "complete",
            f"Location analysis complete — zone: {geo_data.get('zoning_type','?')}, "
            f"FSI: {geo_data.get('fsi_allowed','?')}",
            data={"zoning_type": geo_data.get("zoning_type"),
                   "fsi_allowed": geo_data.get("fsi_allowed"),
                   "climate_zone": geo_data.get("climate_zone")},
        )
    except Exception as exc:
        _log_error(state, "geo_agent", exc)
        # Minimal safe fallback so downstream agents can still run
        state["geo_data"] = {
            "latitude": state["latitude"],
            "longitude": state["longitude"],
            "plot_area": state["plot_area_sqm"],
            "fsi_allowed": 1.5,
            "zoning_type": "residential_suburban",
            "climate_zone": "tropical",
            "optimal_solar_orientation": 180.0 if state["latitude"] >= 0 else 0.0,
            "annual_rainfall_mm": 800,
            "is_metro_city": False,
            "flood_risk": "low",
            "amenity_count": 0,
        }
        await _progress(state, "geo", "error", f"Geo agent error (using defaults): {exc}")
    return state


async def run_design_evolution(state: PipelineState) -> PipelineState:
    """Node 2 — Evolutionary algorithm: produces 5 unique design variants."""
    await _progress(state, "design", "running", "Evolving unique design variants…")

    async def _evolution_cb(event: dict) -> None:
        await _progress(state, "design", "running", event.get("message", "Evolving…"))

    try:
        variants = await evolve_designs(
            plot_area=state["plot_area_sqm"],
            floors=state["floors"],
            budget=state["budget_inr"],
            style_prefs=state["style_preferences"],
            geo_data=state["geo_data"],
            progress_callback=_evolution_cb,
            population_size=10,
            generations=3,
            final_variants=5,
        )

        # Normalise: ensure dna is always a plain dict (serialisable)
        serialised: list[dict] = []
        for v in variants:
            dna_obj = v.get("dna")
            if hasattr(dna_obj, "__dataclass_fields__"):
                dna_dict = asdict(dna_obj)
            elif hasattr(dna_obj, "__dict__"):
                dna_dict = vars(dna_obj)
            elif isinstance(dna_obj, dict):
                dna_dict = dna_obj
            else:
                dna_dict = {}

            serialised.append({
                "dna": dna_dict,
                "dna_dict": v.get("dna_dict", dna_dict),
                "score": v.get("score", 0.0),
                "generation": v.get("generation", 0),
                "lineage": v.get("lineage", "unknown"),
                "rank": v.get("rank", len(serialised) + 1),
                "characteristics": v.get("characteristics", {}),
                "evolution_summary": v.get("evolution_summary", {}),
            })

        state["design_variants"] = serialised
        state["completed_agents"].append("design")
        top_score = serialised[0]["score"] if serialised else 0
        await _progress(
            state, "design", "complete",
            f"Generated {len(serialised)} unique design variants (top score: {top_score:.1f})",
            data={"variant_count": len(serialised), "top_score": top_score},
        )
    except Exception as exc:
        _log_error(state, "design_agent", exc)
        state["design_variants"] = []
        await _progress(state, "design", "error", f"Design evolution error: {exc}")
    return state


async def run_layout_agent(state: PipelineState) -> PipelineState:
    """Node 3a — AI floor plan generation using Claude Sonnet + SVG renderer."""
    await _progress(state, "layout", "running", "Generating AI floor plans…")
    try:
        best_dna = _best_dna(state)
        layout = await generate_layout(
            plot_area_sqm=state["plot_area_sqm"],
            floors=state["floors"],
            budget_inr=state["budget_inr"],
            design_dna=best_dna,
            geo_data=state.get("geo_data", {}),
        )
        state["layout_data"] = layout
        state["completed_agents"].append("layout")
        unit = layout.get("unit_type", "")
        await _progress(
            state, "layout", "complete",
            f"Floor plans generated ({unit.upper() if unit else 'N/A'})",
            data={
                "unit_type": unit,
                "highlights": layout.get("highlights", []),
                "space_metrics": layout.get("space_metrics", {}),
            },
        )
    except Exception as exc:
        _log_error(state, "layout_agent", exc)
        state["layout_data"] = {"error": str(exc)}
        await _progress(state, "layout", "error", f"Layout agent error: {exc}")
    return state


async def run_cost_agent(state: PipelineState) -> PipelineState:
    """Node 3b — INR cost breakdown + Claude Haiku ROI analysis."""
    await _progress(state, "cost", "running", "Calculating construction costs and ROI…")
    try:
        best_dna = _best_dna(state)
        cost = await estimate_costs(
            plot_area_sqm=state["plot_area_sqm"],
            floors=state["floors"],
            budget_inr=state["budget_inr"],
            geo_data=state.get("geo_data", {}),
            design_dna=best_dna,
        )
        state["cost_data"] = cost
        state["completed_agents"].append("cost")
        total = cost.get("total_project_cost_inr", 0)
        await _progress(
            state, "cost", "complete",
            f"Cost estimate: ₹{total:,} ({cost.get('tier_label','?')})",
            data={
                "total_inr": total,
                "tier": cost.get("tier"),
                "within_budget": cost.get("within_budget"),
                "budget_utilisation_pct": cost.get("budget_utilisation_pct"),
            },
        )
    except Exception as exc:
        _log_error(state, "cost_agent", exc)
        state["cost_data"] = {"error": str(exc)}
        await _progress(state, "cost", "error", f"Cost agent error: {exc}")
    return state


async def run_compliance_agent(state: PipelineState) -> PipelineState:
    """Node 3c — Deterministic UDCPR 2020 / NBC 2016 compliance checks."""
    await _progress(state, "compliance", "running", "Checking FSI, setbacks, and zoning compliance…")
    try:
        best_dna = _best_dna(state)
        compliance = await check_compliance(
            plot_area_sqm=state["plot_area_sqm"],
            floors=state["floors"],
            design_dna=best_dna,
            geo_data=state.get("geo_data", {}),
        )
        state["compliance_data"] = compliance
        state["completed_agents"].append("compliance")
        passed = compliance.get("passed", False)
        n_issues = len(compliance.get("issues", []))
        status_msg = (
            "✓ Fully compliant"
            if passed
            else f"⚠ {n_issues} issue(s) found — revision required"
        )
        await _progress(
            state, "compliance", "complete", status_msg,
            data={
                "passed": passed,
                "compliance_score_pct": compliance.get("compliance_score_pct"),
                "issues_count": n_issues,
                "warnings_count": len(compliance.get("warnings", [])),
            },
        )
    except Exception as exc:
        _log_error(state, "compliance_agent", exc)
        state["compliance_data"] = {"error": str(exc), "passed": False}
        await _progress(state, "compliance", "error", f"Compliance agent error: {exc}")
    return state


async def run_sustainability_agent(state: PipelineState) -> PipelineState:
    """Node 3d — PVGIS solar + ventilation/water/material green score."""
    await _progress(state, "sustainability", "running", "Analysing solar potential and sustainability…")
    try:
        best_dna = _best_dna(state)
        sustain = await analyze_sustainability(
            latitude=state["latitude"],
            longitude=state["longitude"],
            plot_area_sqm=state["plot_area_sqm"],
            floors=state["floors"],
            design_dna=best_dna,
            geo_data=state.get("geo_data", {}),
        )
        state["sustainability_data"] = sustain
        state["completed_agents"].append("sustainability")
        await _progress(
            state, "sustainability", "complete",
            f"Green rating: {sustain.get('green_rating','?')} "
            f"(score: {sustain.get('green_score','?')}/100)",
            data={
                "green_score": sustain.get("green_score"),
                "green_rating": sustain.get("green_rating"),
                "igbc_equivalent": sustain.get("igbc_equivalent"),
                "solar_annual_kwh": sustain.get("solar", {}).get("annual_generation_kwh"),
            },
        )
    except Exception as exc:
        _log_error(state, "sustainability_agent", exc)
        state["sustainability_data"] = {"error": str(exc)}
        await _progress(state, "sustainability", "error", f"Sustainability agent error: {exc}")
    return state


# ---------------------------------------------------------------------------
# LangGraph pipeline (optional)
# ---------------------------------------------------------------------------

def build_pipeline():
    """
    Construct and compile the LangGraph StateGraph.
    Only call this when _LANGGRAPH_AVAILABLE is True.

    Topology:
        geo ──► design_evolution ──┬──► layout         ──► END
                                   ├──► cost            ──► END
                                   ├──► compliance      ──► END
                                   └──► sustainability  ──► END
    """
    if not _LANGGRAPH_AVAILABLE:
        return None

    graph: StateGraph = StateGraph(PipelineState)

    graph.add_node("geo",            run_geo_agent)
    graph.add_node("design_evolution", run_design_evolution)
    graph.add_node("layout",         run_layout_agent)
    graph.add_node("cost",           run_cost_agent)
    graph.add_node("compliance",     run_compliance_agent)
    graph.add_node("sustainability", run_sustainability_agent)

    # Sequential phase
    graph.set_entry_point("geo")
    graph.add_edge("geo", "design_evolution")

    # Fan-out: design_evolution branches to all parallel nodes
    graph.add_edge("design_evolution", "layout")
    graph.add_edge("design_evolution", "cost")
    graph.add_edge("design_evolution", "compliance")
    graph.add_edge("design_evolution", "sustainability")

    # All parallel nodes terminate
    graph.add_edge("layout",         END)
    graph.add_edge("cost",           END)
    graph.add_edge("compliance",     END)
    graph.add_edge("sustainability", END)

    return graph.compile()


# Module-level compiled pipeline (None if LangGraph not installed)
PIPELINE = build_pipeline()


# ---------------------------------------------------------------------------
# Canonical entry-point
# ---------------------------------------------------------------------------

async def run_pipeline(
    project_id: str,
    latitude: float,
    longitude: float,
    plot_area_sqm: float,
    budget_inr: int,
    floors: int,
    style_preferences: list[str],
    progress_callback: Optional[Callable] = None,
) -> dict[str, Any]:
    """
    Run the full ArchAI agent pipeline and return the merged state dict.

    This function works whether or not LangGraph is installed:
      - With LangGraph: delegates to the compiled StateGraph (`PIPELINE`)
        which handles node scheduling. LangGraph 0.0.x executes nodes
        sequentially even when edges fan-out, so we also run Phase 2
        via asyncio.gather for true parallelism.
      - Without LangGraph: runs Phase 1 sequentially + Phase 2 with
        asyncio.gather directly.

    Args:
        project_id         : Unique project identifier (UUID string).
        latitude           : Site latitude (decimal degrees).
        longitude          : Site longitude (decimal degrees).
        plot_area_sqm      : Plot area in square metres.
        budget_inr         : Total project budget in INR.
        floors             : Number of floors.
        style_preferences  : List of style keywords from the user.
        progress_callback  : Async callable receiving progress dicts.

    Returns:
        Merged PipelineState dict with all agent outputs.
    """
    t0 = time.perf_counter()

    initial_state: PipelineState = PipelineState(
        project_id=project_id,
        latitude=latitude,
        longitude=longitude,
        plot_area_sqm=plot_area_sqm,
        budget_inr=budget_inr,
        floors=floors,
        style_preferences=style_preferences or [],
        geo_data=None,
        design_variants=None,
        layout_data=None,
        cost_data=None,
        compliance_data=None,
        sustainability_data=None,
        current_agent="starting",
        completed_agents=[],
        errors=[],
        progress_callback=progress_callback,
        _started_at=t0,
    )

    # ── Phase 1: Sequential (geo → evolution) ────────────────────────────
    state = await run_geo_agent(initial_state)
    state = await run_design_evolution(state)

    # ── Phase 2: Parallel (layout | cost | compliance | sustainability) ──
    # Pass independent copies so concurrent mutations don't clash.
    phase2_states = await asyncio.gather(
        run_layout_agent(_copy_state(state)),
        run_cost_agent(_copy_state(state)),
        run_compliance_agent(_copy_state(state)),
        run_sustainability_agent(_copy_state(state)),
        return_exceptions=False,   # individual agents already trap their own exceptions
    )

    # Merge Phase 2 outputs back into the canonical state
    merge_keys = ["layout_data", "cost_data", "compliance_data", "sustainability_data"]
    for result_state in phase2_states:
        for key in merge_keys:
            if result_state.get(key) is not None:
                state[key] = result_state[key]
        for agent in result_state.get("completed_agents", []):
            if agent not in state["completed_agents"]:
                state["completed_agents"].append(agent)
        state["errors"].extend(result_state.get("errors", []))

    # ── Final progress event ─────────────────────────────────────────────
    elapsed = round(time.perf_counter() - t0, 2)
    n_done = len(state["completed_agents"])
    n_errors = len(state["errors"])

    if progress_callback:
        await progress_callback({
            "agent": "orchestrator",
            "status": "complete",
            "message": (
                f"Pipeline complete — {n_done} agent(s) finished"
                + (f", {n_errors} error(s)" if n_errors else "")
                + f" in {elapsed}s"
            ),
            "data": {
                "completed_agents": state["completed_agents"],
                "errors": state["errors"],
                "elapsed_seconds": elapsed,
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    state["elapsed_seconds"] = elapsed
    state["generation_id"] = f"gen_{project_id}_{int(t0)}"
    return dict(state)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _best_dna(state: PipelineState) -> dict:
    """Return the top-ranked design DNA as a plain dict."""
    variants = state.get("design_variants")
    if variants and len(variants) > 0:
        dna = variants[0].get("dna_dict") or variants[0].get("dna", {})
        return dna if isinstance(dna, dict) else {}
    return {}


def _copy_state(state: PipelineState) -> PipelineState:
    """
    Shallow-copy the state for parallel dispatch.
    Lists that may be mutated (completed_agents, errors) are duplicated.
    """
    copied = PipelineState(**state)
    copied["completed_agents"] = list(state.get("completed_agents", []))
    copied["errors"] = list(state.get("errors", []))
    return copied


async def _progress(
    state: PipelineState,
    agent: str,
    status: str,
    message: str,
    data: Optional[dict] = None,
) -> None:
    """Emit a structured progress event to the WebSocket callback."""
    state["current_agent"] = agent
    cb = state.get("progress_callback")
    if callable(cb):
        try:
            await cb({
                "agent": agent,
                "status": status,        # "running" | "complete" | "error"
                "message": message,
                "data": data,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        except Exception as cb_exc:
            logger.warning("Progress callback raised: %s", cb_exc)


def _log_error(state: PipelineState, agent_name: str, exc: Exception) -> None:
    msg = f"{agent_name}: {exc}"
    state["errors"].append(msg)
    logger.error("Agent error — %s", msg, exc_info=exc)