"""
services/layout_service.py

Streaming layout generation via Claude.

Generates 3 architecturally UNIQUE building layout configurations for an
approved project. Uses Claude streaming so progress can be published chunk-by-chunk
to a Redis pub/sub channel (→ forwarded over WebSocket to the browser).

Flow:
  generate_layouts(project_id, feasibility, requirements, job_id, on_progress)
      build seeds — compact (< 33), balanced (33–66), premium (> 66)
      build_layout_prompt()
      async stream → accumulate text → publish chunks to Redis
      parse JSON array → validate 3× LayoutConfigResult
      auto-retry (non-streaming) if JSON invalid
      recalculate financials with pricing.py constants
      save to layout_configurations table
      return List[LayoutConfigResult]
"""
from __future__ import annotations

import json
import logging
import random
import uuid
from typing import Any, Callable, Awaitable

import anthropic
from pydantic import BaseModel, Field, ValidationError, field_validator

from config import get_settings
from services.claude_service import ClaudeFeasibilityResult, _strip_code_fences
from utils.pricing import get_pricing, estimate_financials, pricing_table_for_prompt

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models for the Claude layout JSON response
# ─────────────────────────────────────────────────────────────────────────────

class LayoutFootprint(BaseModel):
    shape:    str   # e.g. "L-shaped", "rectangular", "U-shaped", "tower"
    width_ft: float = Field(..., gt=0)
    depth_ft: float = Field(..., gt=0)


class LayoutUnitMixItem(BaseModel):
    type:       str    # studio / 1BHK / 2BHK / 3BHK / 4BHK+
    count:      int    = Field(..., ge=0)
    area_sqft:  float  = Field(..., gt=0)  # carpet area per unit


class LayoutParking(BaseModel):
    type:     str   # surface | stilt | podium | basement | none
    capacity: int   = Field(..., ge=0)

    @field_validator("type")
    @classmethod
    def normalise_parking_type(cls, v: str) -> str:
        allowed = {"surface", "stilt", "podium", "basement", "none"}
        return v.lower() if v.lower() in allowed else "surface"


class LayoutConfigResult(BaseModel):
    """
    One AI-generated building layout configuration.
    This is an INTERNAL model (returned by ClaudeLayoutService).
    It maps onto the layout_configurations DB table and the frontend 3D viewer.
    """
    layout_id:    str = Field(default_factory=lambda: str(uuid.uuid4()))
    concept_name: str = Field(..., max_length=80)
    design_philosophy: str

    building_footprint: LayoutFootprint
    floors:      int   = Field(..., ge=1, le=80)
    unit_mix:    list[LayoutUnitMixItem]
    total_units: int   = Field(..., ge=0)

    ground_floor_uses: list[str]
    amenities:         list[str]
    parking:           LayoutParking

    structural_notes: str = ""
    strengths:        list[str] = Field(default_factory=list)
    limitations:      list[str] = Field(default_factory=list)

    # Financials (INR)
    estimated_construction_cost_inr: float
    estimated_sale_revenue_inr:      float
    roi_pct:                         float

    # Seed used to generate this layout (for reproducibility)
    seed: int = 0


# ─────────────────────────────────────────────────────────────────────────────
# Prompt constants
# ─────────────────────────────────────────────────────────────────────────────

LAYOUT_SYSTEM_PROMPT = (
    "You are a creative residential architectural planner. "
    "Generate exactly 3 UNIQUE layout configurations. "
    "Each must be architecturally distinct. "
    "Respond ONLY in valid JSON."
)

# Personality descriptions keyed by tier
SEED_PERSONALITIES: dict[str, dict[str, str]] = {
    "compact": {
        "label":        "Compact Maximiser",
        "strategy":     (
            "Maximise total unit count. Use double-loaded corridors. "
            "Prioritise sellable area over generous common spaces. "
            "Tight but efficient floor plates."
        ),
        "unit_hint":    "Prefer studio, 1BHK and 2BHK units in higher quantities.",
        "amenity_hint": "Keep amenity footprint lean — basic gym, open landscaping.",
        "footprint":    "Rectangular or bar-shaped floor plate for corridor efficiency.",
    },
    "balanced": {
        "label":        "Community Living",
        "strategy":     (
            "Balance unit count with quality amenities and natural light. "
            "Create a sense of community with ample open spaces. "
            "Mix of unit sizes for diverse demographic appeal."
        ),
        "unit_hint":    "Equal spread of 2BHK and 3BHK with some studio/1BHK.",
        "amenity_hint": "Full amenity package: swimming pool, gym, clubhouse, garden.",
        "footprint":    "L-shaped or courtyard form for cross-ventilation.",
    },
    "premium": {
        "label":        "Luxury Residences",
        "strategy":     (
            "Fewer but significantly larger units. Double-height lobby, sky lounge, "
            "premium landscaping. Wide corridors and large balconies. "
            "Emphasis on exclusivity and lifestyle branding."
        ),
        "unit_hint":    "Larger 3BHK and 4BHK+. Consider duplex penthouses on top 2 floors.",
        "amenity_hint": "Premium: infinity pool, sky garden, concierge desk, EV charging.",
        "footprint":    "Tower form or Y-shaped for panoramic views from every unit.",
    },
}

LAYOUT_RESPONSE_SCHEMA = """[
  {
    "layout_id": "uuid string",
    "concept_name": "short catchy name (max 60 chars)",
    "design_philosophy": "2-3 sentences explaining the spatial concept",
    "building_footprint": {
      "shape": "rectangular | L-shaped | U-shaped | tower | Y-shaped | courtyard",
      "width_ft": number,
      "depth_ft": number
    },
    "floors": integer,
    "unit_mix": [
      {"type": "2BHK", "count": integer, "area_sqft": number},
      ...
    ],
    "total_units": integer,
    "ground_floor_uses": ["lobby", "parking", "retail", "amenity", ...],
    "amenities": ["Swimming pool", "Gym", ...],
    "parking": {"type": "podium | basement | stilt | surface | none", "capacity": integer},
    "structural_notes": "key structural / material notes",
    "strengths": ["...", "...", "..."],
    "limitations": ["...", "..."],
    "estimated_construction_cost_inr": number,
    "estimated_sale_revenue_inr": number,
    "roi_pct": number
  },
  { ... layout 2 ... },
  { ... layout 3 ... }
]"""


# ─────────────────────────────────────────────────────────────────────────────
# Seed generation
# ─────────────────────────────────────────────────────────────────────────────

def generate_seeds() -> tuple[int, int, int]:
    """
    Return 3 integer seeds with guaranteed spread:
      s1 ∈ [1, 32]   → compact / maximum units
      s2 ∈ [33, 66]  → balanced units + amenities
      s3 ∈ [67, 99]  → premium / fewer larger units
    """
    return (
        random.randint(1,  32),
        random.randint(33, 66),
        random.randint(67, 99),
    )


def seed_to_personality(seed: int) -> tuple[str, dict[str, str]]:
    """Map a seed integer to its personality tier and description."""
    if seed < 33:
        return "compact",  SEED_PERSONALITIES["compact"]
    if seed < 67:
        return "balanced", SEED_PERSONALITIES["balanced"]
    return "premium",  SEED_PERSONALITIES["premium"]


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builder
# ─────────────────────────────────────────────────────────────────────────────

def build_layout_prompt(
    feasibility:  ClaudeFeasibilityResult,
    requirements: dict[str, Any],
    seeds:        tuple[int, int, int],
    city:         str | None,
) -> str:
    cfg       = feasibility.approved_config
    city_name = city or "Unknown City"
    pricing   = pricing_table_for_prompt(city)

    # Approved config block
    if cfg:
        approved_block = f"""\
- Maximum floors permitted: {cfg.max_floors}
- Recommended floors: {cfg.recommended_floors}
- Maximum FSI: {cfg.max_fsi}
- Usable built-up area: {cfg.usable_area_sqft:,.0f} sqft
- Max floor plate: {cfg.floor_plate_sqft:,.0f} sqft
- Setbacks: Front {cfg.setbacks.front_m}m | Rear {cfg.setbacks.rear_m}m | Side {cfg.setbacks.side_m}m
- Parking recommendation: {cfg.parking_type}"""
    else:
        approved_block = "- No approved config (feasibility failed — generate indicative layouts only)"

    # Requested unit mix
    unit_mix_raw = requirements.get("unit_mix") or []
    requested_units = [
        u for u in unit_mix_raw
        if u.get("enabled") and int(u.get("count") or 0) > 0
    ]
    if requested_units:
        unit_pref = ", ".join(
            f"{u['type'].upper()}:{u['count']}" for u in requested_units
        )
    else:
        unit_pref = "Not specified — AI should suggest based on project type"

    # Requested amenities
    amenities_req = requirements.get("amenities") or []
    amenities_str = (
        ", ".join(a.replace("_", " ").title() for a in amenities_req)
        if amenities_req else "None specified"
    )

    # Other requirements
    project_type  = requirements.get("project_type", "apartment")
    style         = (requirements.get("requirements") or {}).get("style") or "modern"
    budget_tier   = (requirements.get("requirements") or {}).get("budget_tier") or "mid_range"
    special_notes = (requirements.get("requirements") or {}).get("special_notes") or "None"

    # Three seed blocks
    s1, s2, s3 = seeds
    _, p1 = seed_to_personality(s1)
    _, p2 = seed_to_personality(s2)
    _, p3 = seed_to_personality(s3)

    def seed_block(n: int, seed: int, p: dict[str, str]) -> str:
        return f"""\
LAYOUT {n} — "{p['label']}" (seed={seed})
  Strategy   : {p['strategy']}
  Units      : {p['unit_hint']}
  Amenities  : {p['amenity_hint']}
  Footprint  : {p['footprint']}"""

    return f"""\
## APPROVED FEASIBILITY PARAMETERS
{approved_block}

## PROJECT REQUIREMENTS
- Project type   : {project_type}
- Style          : {style}
- Budget tier    : {budget_tier}
- Preferred units: {unit_pref}
- Amenities asked: {amenities_str}
- Special notes  : {special_notes}

## CITY FINANCIAL CONSTANTS — {city_name}
{pricing}
- Use these EXACT rates to compute estimated_construction_cost_inr and estimated_sale_revenue_inr.
- Apply ~23% for structure/common areas overhead on construction.
- Saleable area ≈ 77% of gross built-up area.

## LAYOUT SEED PERSONALITIES
Generate exactly 3 DISTINCT layouts, one per personality below.
Each layout must differ in: footprint shape, floor count, unit mix, and amenity programme.

{seed_block(1, s1, p1)}

{seed_block(2, s2, p2)}

{seed_block(3, s3, p3)}

## RULES
1. layout_id must be a UUID v4 string
2. total_units must equal sum of all unit_mix[].count
3. floors must not exceed the approved max_floors ({cfg.max_floors if cfg else "N/A"})
4. floor_plate (width_ft × depth_ft) must not exceed {cfg.floor_plate_sqft if cfg else "N/A"} sqft
5. financial figures must be in full INR (not lakhs/crores abbreviations)
6. roi_pct = (sale_revenue - construction_cost) / construction_cost × 100
7. Include ≥ 3 strengths and ≥ 2 limitations per layout
8. Each layout concept_name must be unique and evocative

## REQUIRED JSON RESPONSE (array, no other text, no markdown, no code blocks)
{LAYOUT_RESPONSE_SCHEMA}
"""


# ─────────────────────────────────────────────────────────────────────────────
# LayoutService
# ─────────────────────────────────────────────────────────────────────────────

# Type alias for the progress callback
ProgressCallback = Callable[[str, str, int], Awaitable[None]]


class LayoutService:
    """
    Async Claude streaming service for building layout generation.
    Publish real-time chunks to Redis and return validated LayoutConfigResult list.
    """

    def __init__(self) -> None:
        settings = get_settings()
        self.client  = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        self.model   = settings.claude_model
        self.settings = settings

    # ── Main public method ───────────────────────────────────────────────────

    async def generate_layouts(
        self,
        project_id:   str,
        feasibility:  ClaudeFeasibilityResult,
        requirements: dict[str, Any],
        job_id:       str | None = None,
        on_progress:  ProgressCallback | None = None,
    ) -> list[LayoutConfigResult]:
        """
        Stream 3 layout configurations from Claude.

        Args:
            project_id  : Project UUID (for DB save).
            feasibility : Result of check_feasibility().
            requirements: Full project creation body (contains city, amenities, etc.).
            job_id      : If set, stream chunks are published to Redis channel job-progress:{job_id}.
            on_progress : Optional async callback(stage, message, pct) for progress events.

        Returns:
            List of exactly 3 validated LayoutConfigResult objects.
        """
        city  = requirements.get("location_city")
        seeds = generate_seeds()

        logger.info(
            "[layouts] Starting layout generation: project=%s seeds=%s city=%s",
            project_id, seeds, city,
        )

        if on_progress:
            await on_progress("layouts", f"Generating 3 unique layout concepts… (seeds {seeds})", 88)

        # ── Build Redis connection (optional) ────────────────────────────────
        redis_client = await self._connect_redis()

        user_prompt  = build_layout_prompt(feasibility, requirements, seeds, city)
        messages     = [{"role": "user", "content": user_prompt}]
        accumulated  = ""
        total_tokens = 0

        # ── Streaming call with auto-retry on JSON failure ───────────────────
        for attempt in range(2):
            if attempt == 1 and on_progress:
                await on_progress("layouts", "Retrying layout generation with JSON correction…", 89)

            accumulated, total_tokens = await self._stream(
                messages     = messages,
                job_id       = job_id,
                redis_client = redis_client,
                on_progress  = on_progress,
            )

            clean = _strip_code_fences(accumulated)

            try:
                data    = json.loads(clean)
                layouts = self._validate_layouts(data, seeds, city, requirements)

                logger.info("[layouts] Generated %d layouts (%d tokens)", len(layouts), total_tokens)

                # Save to DB
                await self._save_to_db(project_id, layouts, raw_text=clean, tokens=total_tokens)

                if on_progress:
                    await on_progress("layouts", f"✅ {len(layouts)} layouts ready!", 98)

                return layouts

            except (json.JSONDecodeError, ValidationError, ValueError) as exc:
                if attempt == 0:
                    logger.warning("[layouts] Attempt 1 JSON error: %s — retrying", str(exc)[:150])
                    messages.append({"role": "assistant", "content": accumulated})
                    messages.append({
                        "role": "user",
                        "content": (
                            f"Your response failed JSON validation.\n"
                            f"Error: {str(exc)[:300]}\n\n"
                            "Return ONLY the corrected JSON array of 3 layout objects. "
                            "No markdown, no prose, no code fences."
                        ),
                    })
                    continue

                logger.error("[layouts] Failed after 2 attempts: %s", exc)
                raise ValueError(f"Layout generation returned invalid JSON after 2 attempts: {exc}") from exc

        if redis_client:
            try:
                await redis_client.close()
            except Exception:
                pass

        raise RuntimeError("generate_layouts: retry loop exited without result")

    # ── Streaming helper ─────────────────────────────────────────────────────

    async def _stream(
        self,
        messages:     list[dict],
        job_id:       str | None,
        redis_client: Any | None,
        on_progress:  ProgressCallback | None,
    ) -> tuple[str, int]:
        """
        Run a single streaming Claude call. Returns (full_text, total_tokens).
        Publishes each text chunk to Redis channel `job-progress:{job_id}` if available.
        """
        accumulated  = ""
        chunk_count  = 0
        total_tokens = 0

        async with self.client.messages.stream(
            model     = self.model,
            system    = LAYOUT_SYSTEM_PROMPT,
            messages  = messages,
            max_tokens = 8192,
            temperature = 0.7,   # Higher creativity for diverse layouts
        ) as stream:

            async for text_chunk in stream.text_stream:
                accumulated += text_chunk
                chunk_count += 1

                # ── Publish raw chunk to Redis ────────────────────────────
                if redis_client and job_id:
                    try:
                        await redis_client.publish(
                            f"job-progress:{job_id}",
                            json.dumps({
                                "type":           "layout_stream",
                                "chunk":          text_chunk,
                                "chars_received": len(accumulated),
                            }),
                        )
                    except Exception as e:
                        logger.debug("[layouts] Redis publish error: %s", e)

                # ── Throttled progress callbacks (every ~50 chunks) ───────
                if on_progress and chunk_count % 50 == 0:
                    # Rough count of layouts seen so far
                    layouts_seen = accumulated.count('"concept_name"')
                    pct = min(88 + layouts_seen * 3, 96)
                    await on_progress(
                        "layouts",
                        f"Generating layout {layouts_seen + 1} of 3…",
                        pct,
                    )

            # Get final message for token counts
            final = await stream.get_final_message()
            total_tokens = final.usage.input_tokens + final.usage.output_tokens

        logger.info(
            "[layouts] Stream complete: %d chars, %d tokens",
            len(accumulated), total_tokens,
        )
        return accumulated, total_tokens

    # ── Validation + financial recalculation ────────────────────────────────

    def _validate_layouts(
        self,
        data:          Any,
        seeds:         tuple[int, int, int],
        city:          str | None,
        requirements:  dict[str, Any],
    ) -> list[LayoutConfigResult]:
        """
        Validate Claude's JSON array, recalculate financials using pricing.py constants,
        and attach seed metadata.
        """
        if not isinstance(data, list):
            raise ValueError(f"Expected JSON array, got {type(data).__name__}")
        if len(data) < 3:
            raise ValueError(f"Expected 3 layouts, got {len(data)}")

        budget_tier = ((requirements.get("requirements") or {}).get("budget_tier") or "mid_range")
        results: list[LayoutConfigResult] = []

        for i, raw_layout in enumerate(data[:3]):
            seed = seeds[i]

            # Ensure layout_id is a valid UUID string
            if not raw_layout.get("layout_id"):
                raw_layout["layout_id"] = str(uuid.uuid4())

            # Recalculate financials with our pricing constants (overrides Claude's estimate)
            unit_mix  = raw_layout.get("unit_mix") or []
            floors    = int(raw_layout.get("floors") or 1)
            footprint = raw_layout.get("building_footprint") or {}
            w = float(footprint.get("width_ft") or 50)
            d = float(footprint.get("depth_ft") or 50)
            floor_plate_sqft = w * d
            gross_sqft       = floor_plate_sqft * floors

            financials = estimate_financials(
                gross_built_sqft = gross_sqft,
                city             = city,
                budget_tier      = budget_tier,
            )
            raw_layout["estimated_construction_cost_inr"] = financials["construction_cost_inr"]
            raw_layout["estimated_sale_revenue_inr"]      = financials["sale_revenue_inr"]
            raw_layout["roi_pct"]                         = financials["roi_pct"]

            # Validate with Pydantic
            layout = LayoutConfigResult.model_validate(raw_layout)
            layout.seed = seed
            results.append(layout)

        return results

    # ── Redis connection ─────────────────────────────────────────────────────

    async def _connect_redis(self) -> Any | None:
        """Return an async Redis client, or None if Redis is unavailable."""
        try:
            import redis.asyncio as aioredis  # type: ignore
            r = await aioredis.from_url(
                self.settings.redis_url,
                decode_responses=True,
            )
            await r.ping()
            logger.debug("[layouts] Redis connected")
            return r
        except Exception as exc:
            logger.warning("[layouts] Redis not available (%s) — chunks not published", exc)
            return None

    # ── DB persistence ───────────────────────────────────────────────────────

    async def _save_to_db(
        self,
        project_id: str,
        layouts:    list[LayoutConfigResult],
        raw_text:   str,
        tokens:     int,
    ) -> None:
        """Persist layout configurations to Supabase. Non-fatal on failure."""
        try:
            from supabase import acreate_client  # type: ignore

            supabase = await acreate_client(
                self.settings.supabase_url,
                self.settings.supabase_service_role_key,
            )

            for idx, layout in enumerate(layouts):
                record = {
                    "id":              layout.layout_id,
                    "project_id":      project_id,
                    "design_seed":     layout.seed,
                    "concept_name":    layout.concept_name,
                    "floor_plan":      {
                        "footprint":    layout.building_footprint.model_dump(),
                        "floors":       layout.floors,
                        "ground_floor_uses": layout.ground_floor_uses,
                        "structural_notes":  layout.structural_notes,
                        "design_philosophy": layout.design_philosophy,
                        "strengths":    layout.strengths,
                        "limitations":  layout.limitations,
                    },
                    "unit_mix":        [u.model_dump() for u in layout.unit_mix],
                    "amenities":       {"list": layout.amenities},
                    "geometry_hints":  {
                        "width_ft": layout.building_footprint.width_ft,
                        "depth_ft": layout.building_footprint.depth_ft,
                        "shape":    layout.building_footprint.shape,
                    },
                    "total_units":             layout.total_units,
                    "construction_cost_inr":   layout.estimated_construction_cost_inr,
                    "sale_revenue_inr":        layout.estimated_sale_revenue_inr,
                    "roi_pct":                 layout.roi_pct,
                }
                await supabase.table("layout_configurations").insert(record).execute()

            logger.info("[layouts] Saved %d layouts for project %s", len(layouts), project_id)

        except Exception as exc:
            logger.warning("[layouts] DB save failed (non-fatal): %s — %s", type(exc).__name__, exc)


# ─────────────────────────────────────────────────────────────────────────────
# Module-level singleton
# ─────────────────────────────────────────────────────────────────────────────

_service: LayoutService | None = None


def get_layout_service() -> LayoutService:
    """Return the module-level LayoutService singleton (lazy-init)."""
    global _service
    if _service is None:
        _service = LayoutService()
    return _service
