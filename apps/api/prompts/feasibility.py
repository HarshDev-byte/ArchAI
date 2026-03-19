"""
Prompt templates for Claude claude-sonnet-4-6.

Each function returns a fully-rendered system + user message pair
ready to pass to the Anthropic messages API.
"""
from __future__ import annotations

from models.project import PlotInput


FEASIBILITY_SYSTEM = """\
You are an expert architectural consultant and urban planner with deep knowledge of \
global zoning regulations, building codes, Floor Area Ratios (FAR/FSI), setback \
requirements, and sustainable design principles.

Your task is to analyse a land parcel submitted as a GeoJSON polygon and return a \
structured JSON feasibility report. Be precise, realistic, and conservative in your \
estimates — err on the side of more restrictive regulation if context is ambiguous.

CRITICAL: You MUST respond with ONLY a valid JSON object matching this exact schema. \
Do not include markdown fences, explanations, or any text outside the JSON object.

Required JSON schema:
{
  "score": <integer 0-100>,
  "zoning_classification": "<string>",
  "max_floors": <integer>,
  "max_far": <float>,
  "setbacks": {
    "front": <float metres>,
    "rear": <float metres>,
    "left": <float metres>,
    "right": <float metres>
  },
  "ground_coverage_pct": <float 0-100>,
  "restrictions": ["<string>", ...],
  "opportunities": ["<string>", ...],
  "summary": "<2-4 sentence plain-English summary>"
}
"""


def build_feasibility_prompt(payload: PlotInput, area_sqm: float) -> str:
    """
    Build the user message for the Claude feasibility call.

    Args:
        payload: The incoming PlotInput with parcel GeoJSON and context.
        area_sqm: Pre-computed parcel area in square metres.

    Returns:
        Formatted user message string.
    """
    location_ctx = (
        f"Location context provided by user: {payload.location_hint}"
        if payload.location_hint
        else "No specific location provided — use global best-practice defaults."
    )

    constraints_ctx = (
        f"Additional programme constraints: {payload.extra_constraints}"
        if payload.extra_constraints
        else "No additional constraints specified."
    )

    return f"""\
Analyse the following land parcel for architectural and development feasibility.

PARCEL DETAILS:
- Area: {area_sqm:.1f} m² ({area_sqm / 10_000:.4f} hectares)
- GeoJSON geometry: {payload.parcel_geojson.model_dump_json()}
- {location_ctx}
- {constraints_ctx}

Provide your feasibility analysis as a JSON object matching the required schema exactly.
Consider typical zoning regulations for the region, reasonable setbacks, FAR limits,
and any geospatial flags (irregular shape, narrow frontage, corner plot, etc.).
"""
