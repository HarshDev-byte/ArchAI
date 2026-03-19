"""
services/claude_service.py

Async Claude AI service for DesignAI.

Primary function: check_feasibility(plot_data, user_id, project_id=None)
  → Calls Claude to produce a structured JSON feasibility + regulatory analysis.

Architecture:
  ┌─────────────────────────────┐
  │  check_feasibility()        │
  │   build_user_prompt()   ────┼─→ formatted site brief
  │   _call_with_retry(2)   ────┼─→ AsyncAnthropic API
  │   _parse_and_validate() ────┼─→ Pydantic ClaudeFeasibilityResult
  │   _save_to_db()         ────┼─→ Supabase feasibility_reports (optional)
  └─────────────────────────────┘
"""
from __future__ import annotations

import json
import logging
import math
from typing import Any

import anthropic
from pydantic import BaseModel, Field, ValidationError, field_validator

from config import get_settings

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Conversion constants
# ─────────────────────────────────────────────────────────────────────────────

SQFT_TO_SQM   = 0.092903
SQM_TO_SQFT   = 10.7639
SQFT_TO_CENTS = 0.00247105   # 1 cent = 435.56 sqft

# ─────────────────────────────────────────────────────────────────────────────
# Indian regulatory constants
# ─────────────────────────────────────────────────────────────────────────────

# Floor Space Index by city (developable built-up = FSI × plot area)
FSI_TABLE: dict[str, float] = {
    "mumbai":        2.0,
    "navi mumbai":   2.0,
    "thane":         2.0,
    "pune":          1.75,
    "bangalore":     2.25,
    "bengaluru":     2.25,
    "hyderabad":     3.0,
    "secunderabad":  3.0,
    "delhi":         1.5,
    "new delhi":     1.5,
    "gurgaon":       1.75,
    "gurugram":      1.75,
    "noida":         2.0,
    "greater noida": 2.0,
    "chennai":       1.5,
    "kolkata":       1.5,
    "ahmedabad":     1.8,
    "surat":         2.0,
    "jaipur":        1.75,
    "lucknow":       2.0,
    "kochi":         1.6,
    "coimbatore":    1.5,
}
DEFAULT_FSI = 2.0

# Minimum plot areas (sqft) by project type for RERA registration
MIN_PLOT_SQFT: dict[str, int] = {
    "apartment":  2000,
    "bungalow":   1000,
    "villa":      2000,
    "mixed_use":  3000,
    "township":  50000,
}

# Minimum plot areas required for specific amenities
AMENITY_MIN_PLOT_SQFT: dict[str, int] = {
    "swimming_pool":    3500,
    "podium_parking":  12000,
    "basement_parking": 5000,
}

# Standard setbacks (metres) per NBC / most Indian municipalities
STANDARD_SETBACKS = {"front_m": 4.5, "rear_m": 3.0, "side_m": 2.0}

MAX_GROUND_COVERAGE_PCT = 40.0     # % of plot area
TYPICAL_FLOOR_HEIGHT_M  = 3.0     # metres per floor


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models for the Claude JSON response (internal to this service)
# ─────────────────────────────────────────────────────────────────────────────

class SetbackInfo(BaseModel):
    front_m: float = Field(default=4.5, ge=0)
    rear_m:  float = Field(default=3.0, ge=0)
    side_m:  float = Field(default=2.0, ge=0)


class ApprovedConfig(BaseModel):
    max_floors:         int   = Field(..., ge=1)
    recommended_floors: int   = Field(..., ge=1)
    max_fsi:            float = Field(..., gt=0)
    usable_area_sqft:   float = Field(..., gt=0)
    floor_plate_sqft:   float = Field(..., gt=0)
    setbacks:           SetbackInfo
    parking_type: str = Field(
        ...,
        description="One of: surface | stilt | podium | basement | none",
    )

    @field_validator("parking_type")
    @classmethod
    def validate_parking_type(cls, v: str) -> str:
        allowed = {"surface", "stilt", "podium", "basement", "none"}
        if v.lower() not in allowed:
            return "surface"   # safe fallback instead of raising
        return v.lower()


class ClaudeFeasibilityResult(BaseModel):
    """
    Structured output from Claude's feasibility check.
    This is an INTERNAL model — separate from models.project.FeasibilityResult
    which supports the legacy /api/v1/feasibility endpoint.
    """
    feasible:          bool
    confidence:        float         = Field(..., ge=0.0, le=1.0)
    rejection_reasons: list[str]     = Field(default_factory=list)
    warnings:          list[str]     = Field(default_factory=list)
    approved_config:   ApprovedConfig | None = None
    regulatory_notes:  str           = ""
    nearby_advantages: list[str]     = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────────
# Prompt constants
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = (
    "You are a senior Indian urban planner and RERA compliance expert. "
    "Respond ONLY in valid JSON. No prose, no markdown."
)

RESPONSE_SCHEMA = """{
  "feasible": boolean,
  "confidence": number (0.0–1.0),
  "rejection_reasons": ["string", ...],
  "warnings": ["string", ...],
  "approved_config": {
    "max_floors": integer,
    "recommended_floors": integer,
    "max_fsi": number,
    "usable_area_sqft": number,
    "floor_plate_sqft": number,
    "setbacks": {"front_m": number, "rear_m": number, "side_m": number},
    "parking_type": "surface" | "stilt" | "podium" | "basement" | "none"
  } | null,
  "regulatory_notes": "string (max 200 words)",
  "nearby_advantages": ["string", ...]
}"""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_fsi(city: str | None) -> float:
    """Look up FSI for a city, falling back to DEFAULT_FSI."""
    if not city:
        return DEFAULT_FSI
    return FSI_TABLE.get(city.lower().strip(), DEFAULT_FSI)


def _strip_code_fences(text: str) -> str:
    """Remove ```json ... ``` fences that Claude sometimes adds despite instructions."""
    text = text.strip()
    if text.startswith("```"):
        parts = text.split("```")
        # parts[1] = "json\n{...}", parts[-1] may be empty
        inner = parts[1] if len(parts) > 1 else text
        if inner.lower().startswith("json"):
            inner = inner[4:]
        return inner.strip()
    return text


# ─────────────────────────────────────────────────────────────────────────────
# User prompt builder
# ─────────────────────────────────────────────────────────────────────────────

def build_user_prompt(plot_data: dict[str, Any]) -> str:
    """
    Construct the detailed site brief that Claude will analyse.
    `plot_data` is the deserialized project creation POST body.
    """
    # ── Extract plot values ──────────────────────────────────────────────────
    area_sqft  = float(plot_data.get("plot_area_sqft") or 0)
    area_sqm   = area_sqft * SQFT_TO_SQM
    length_ft  = float(plot_data.get("plot_length_ft") or 0)
    width_ft   = float(plot_data.get("plot_width_ft") or 0)
    city       = (plot_data.get("location_city") or "Unknown City").strip()
    state      = (plot_data.get("location_state") or "India").strip()

    # ── Requirements (nested under requirements key) ─────────────────────────
    reqs          = plot_data.get("requirements") or {}
    nearby        = reqs.get("nearby_context") or "Not available"
    project_type  = (plot_data.get("project_type") or "apartment").lower()
    floors_req    = int(plot_data.get("floors_requested") or 10)
    style         = reqs.get("style") or "modern"
    budget_tier   = (reqs.get("budget_tier") or "mid_range").replace("_", " ")
    target_buyer  = (reqs.get("target_buyer") or "both").replace("_", " ")
    unit_mix_raw  = reqs.get("unit_mix") or []
    amenities     = reqs.get("amenities") or []
    special_notes = reqs.get("special_notes") or "None"

    # ── Derived regulatory values ────────────────────────────────────────────
    fsi                    = _get_fsi(city)
    buildup_sqm            = area_sqm * fsi
    buildup_sqft           = buildup_sqm * SQM_TO_SQFT
    max_footprint_sqft     = area_sqft * (MAX_GROUND_COVERAGE_PCT / 100)
    max_floors_by_fsi      = (
        math.ceil(buildup_sqft / max_footprint_sqft) if max_footprint_sqft > 0 else 0
    )
    min_plot_sqft          = MIN_PLOT_SQFT.get(project_type, 2000)

    # ── Format unit mix ──────────────────────────────────────────────────────
    enabled_units = [
        u for u in unit_mix_raw
        if u.get("enabled") and int(u.get("count") or 0) > 0
    ]
    if enabled_units:
        unit_mix_str = "\n".join(
            f"  • {u['type'].upper()}: {u['count']} units"
            for u in enabled_units
        )
    else:
        unit_mix_str = "  • Not specified — please suggest an optimal mix"

    # ── Format amenities ─────────────────────────────────────────────────────
    amenities_str = (
        ", ".join(a.replace("_", " ").title() for a in amenities)
        if amenities else "None specified"
    )

    # ── Flag amenity-specific area violations ────────────────────────────────
    amenity_alerts: list[str] = []
    for amenity_id, min_sqft in AMENITY_MIN_PLOT_SQFT.items():
        if amenity_id in amenities and area_sqft < min_sqft:
            amenity_alerts.append(
                f"⚠ {amenity_id.replace('_',' ').title()} requires a minimum plot of "
                f"{min_sqft:,} sqft — this plot is only {area_sqft:,.0f} sqft."
            )
    amenity_alert_block = (
        "\n".join(amenity_alerts) if amenity_alerts
        else "No critical area conflicts detected for requested amenities."
    )

    return f"""\
## PLOT INFORMATION
- Area: {area_sqft:,.0f} sqft ({area_sqm:.1f} sqm)
- Dimensions: {length_ft:.0f} ft × {width_ft:.0f} ft
- Location: {city}, {state}
- Nearby amenities (from OpenStreetMap): {nearby}

## PROJECT REQUEST
- Type: {project_type}
- Floors requested: {floors_req}
- Architectural style: {style}
- Budget tier: {budget_tier}
- Target buyer: {target_buyer}
- Unit mix:
{unit_mix_str}
- Amenities requested: {amenities_str}
- Special notes / constraints: {special_notes}

## APPLICABLE REGULATIONS (Indian RERA + National Building Code)
1. Minimum plot size for a {project_type}: {min_plot_sqft:,} sqft
   → This plot: {area_sqft:,.0f} sqft — {"✅ PASSES" if area_sqft >= min_plot_sqft else "❌ FAILS"}

2. FSI for {city}: {fsi}
   → Theoretical maximum built-up area: {buildup_sqft:,.0f} sqft ({buildup_sqm:.1f} sqm)

3. Standard setbacks (NBC): Front 4.5m | Rear 3.0m | Side 2.0m (each)

4. Maximum ground coverage: {MAX_GROUND_COVERAGE_PCT}%
   → Maximum floor plate: {max_footprint_sqft:,.0f} sqft

5. Maximum floors by FSI @ {MAX_GROUND_COVERAGE_PCT}% coverage: {max_floors_by_fsi}

6. Amenity area requirements:
   - Swimming pool: minimum 3,500 sqft plot
   - Podium parking: minimum 12,000 sqft plot
   - Basement parking: minimum 5,000 sqft plot
   {amenity_alert_block}

7. Fire NOC mandatory above 15 m height (approx. 5 floors)
8. RERA registration mandatory if project > 500 sqm built-up
9. Minimum open/landscape area: 33% of total built-up for apartments
10. Parking norms (NBC): 1 ECS per 100 sqm for residential

## TASK
Analyse the above brief against regulations and produce a feasibility assessment.
- feasible=true only if all hard rules pass (min area, FSI, setbacks)
- List every regulatory violation in rejection_reasons
- List soft concerns, risks, or suggestions in warnings
- If feasible, populate approved_config with optimised configuration
- nearby_advantages: identify 2–4 positive neighbourhood factors from the OSM data
- regulatory_notes: concise compliance summary (max 200 words)
- confidence: your certainty about this assessment (0.0–1.0) given available data

## REQUIRED JSON RESPONSE (no other text, no markdown, no code blocks)
{RESPONSE_SCHEMA}
"""


# ─────────────────────────────────────────────────────────────────────────────
# ClaudeService
# ─────────────────────────────────────────────────────────────────────────────

class ClaudeService:
    """
    Thin async wrapper around the Anthropic API for DesignAI's feasibility checks.
    Instantiate once per application lifecycle (it is stateless per request).
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model  = settings.claude_model
        logger.info("ClaudeService initialised [model=%s]", self.model)

    # ── Core public method ───────────────────────────────────────────────────

    async def check_feasibility(
        self,
        plot_data: dict[str, Any],
        user_id: str,
        project_id: str | None = None,
    ) -> ClaudeFeasibilityResult:
        """
        Run an AI feasibility check on a land parcel + project brief.

        Args:
            plot_data:  Deserialized project creation body (from POST /api/v1/projects).
            user_id:    Auth user — for audit logging.
            project_id: If provided, saves the result to feasibility_reports table.

        Returns:
            Validated ClaudeFeasibilityResult.

        Raises:
            ValueError:  If Claude returns invalid JSON after 2 attempts.
            anthropic.*: On API-level errors (rate limit, auth, etc.).
        """
        user_prompt = build_user_prompt(plot_data)
        messages: list[dict[str, str]] = [{"role": "user", "content": user_prompt}]

        raw_text   = ""
        input_tok  = 0
        output_tok = 0

        # ── Retry loop (max 2 attempts with conversation-level correction) ───
        for attempt in range(2):
            logger.info(
                "Claude request [model=%s user=%s attempt=%d]",
                self.model, user_id[:8], attempt + 1,
            )

            response = await self.client.messages.create(
                model=self.model,
                system=SYSTEM_PROMPT,
                messages=messages,
                max_tokens=2048,
                temperature=0.1,   # Low temperature for deterministic JSON
            )

            raw_text   = response.content[0].text
            input_tok  = response.usage.input_tokens
            output_tok = response.usage.output_tokens
            total_tok  = input_tok + output_tok

            logger.info(
                "Claude response received [tokens=%d attempt=%d]",
                total_tok, attempt + 1,
            )

            # Strip code fences Claude occasionally adds despite instructions
            clean_text = _strip_code_fences(raw_text)

            try:
                data   = json.loads(clean_text)
                result = ClaudeFeasibilityResult.model_validate(data)

                logger.info(
                    "Feasibility result: feasible=%s confidence=%.2f",
                    result.feasible, result.confidence,
                )

                # Persist to Supabase (non-fatal if it fails)
                await self._save_to_db(
                    project_id=project_id,
                    result=result,
                    raw_text=clean_text,
                    tokens=total_tok,
                )

                return result

            except (json.JSONDecodeError, ValidationError) as exc:
                if attempt == 0:
                    # Add the bad response to conversation history and ask Claude to fix it
                    logger.warning(
                        "Attempt 1: JSON validation failed (%s). Sending correction request.",
                        type(exc).__name__,
                    )
                    messages.append({"role": "assistant", "content": raw_text})
                    messages.append({
                        "role": "user",
                        "content": (
                            f"Your previous response failed JSON validation.\n"
                            f"Error: {str(exc)[:300]}\n\n"
                            "Fix your response. Return ONLY a single valid JSON object "
                            "exactly matching the schema — no prose, no markdown fences, "
                            "no code blocks, no extra keys."
                        ),
                    })
                    continue   # Go to attempt 2

                # Attempt 2 also failed — raise
                logger.error(
                    "Claude returned invalid JSON after 2 attempts. Last error: %s",
                    exc,
                )
                raise ValueError(
                    f"AI returned invalid feasibility data after 2 attempts: {exc}"
                ) from exc

        # Should be unreachable — loop always returns or raises
        raise RuntimeError("check_feasibility: retry loop exited without result")

    # ── Private: save to Supabase ────────────────────────────────────────────

    async def _save_to_db(
        self,
        project_id: str | None,
        result:     ClaudeFeasibilityResult,
        raw_text:   str,
        tokens:     int,
    ) -> None:
        """
        Persist the feasibility result to the feasibility_reports table.
        Swallows all exceptions — a DB write failure must not abort the response.
        """
        if not project_id:
            return

        try:
            from supabase._async.client import AsyncClient  # type: ignore
            from supabase import acreate_client             # type: ignore

            settings = get_settings()
            supabase: AsyncClient = await acreate_client(
                settings.supabase_url,
                settings.supabase_service_role_key,
            )

            cfg = result.approved_config
            record: dict[str, Any] = {
                "project_id":          project_id,
                "is_feasible":         result.feasible,
                "rejection_reasons":   result.rejection_reasons,
                "warnings":            result.warnings,
                "max_floors":          cfg.max_floors if cfg else None,
                "usable_area_sqft":    cfg.usable_area_sqft if cfg else None,
                "setbacks":            cfg.setbacks.model_dump() if cfg else None,
                "raw_claude_response": json.loads(raw_text),
                "tokens_used":         tokens,
            }

            await supabase.table("feasibility_reports").insert(record).execute()
            logger.info("Saved feasibility report for project_id=%s", project_id)

        except Exception as exc:    # noqa: BLE001
            logger.warning(
                "feasibility_reports DB save failed (non-fatal): %s — %s",
                type(exc).__name__, exc,
            )


# ─────────────────────────────────────────────────────────────────────────────
# Module-level singleton — import and reuse across request handlers
# ─────────────────────────────────────────────────────────────────────────────

_service: ClaudeService | None = None


def get_claude_service() -> ClaudeService:
    """Return the module-level ClaudeService singleton (lazy-init)."""
    global _service
    if _service is None:
        _service = ClaudeService()
    return _service
