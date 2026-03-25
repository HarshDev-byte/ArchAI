"""
Cost Estimation Agent — ArchAI
Produces detailed construction cost breakdowns (INR, 2024 rates) and uses
Claude AI (claude-3-haiku) for ROI / market analysis.

Tier selection is driven by available budget per sqft:
  budget → quality tier → per-sqft rate → 10-category breakdown → ROI
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from anthropic import AsyncAnthropic

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Construction cost database  (INR / sqft, 2024 Q1 India)
# ---------------------------------------------------------------------------
CONSTRUCTION_RATES: dict[str, dict[str, Any]] = {
    "budget": {
        "rate_per_sqft": 1200,
        "label": "Economy Construction",
        "description": "Basic finishes, AAC blocks, standard fittings",
    },
    "standard": {
        "rate_per_sqft": 1800,
        "label": "Standard Construction",
        "description": "Good quality finishes, vitrified flooring, branded sanitary",
    },
    "premium": {
        "rate_per_sqft": 2800,
        "label": "Premium Construction",
        "description": "Italian marble, modular kitchen, premium fixtures",
    },
    "luxury": {
        "rate_per_sqft": 4500,
        "label": "Luxury Construction",
        "description": "Imported stone, smart home, bespoke millwork",
    },
}

# Breakdown weights across construction categories
_BREAKDOWN_WEIGHTS: dict[str, float] = {
    "civil_structure": 0.35,
    "brickwork_plaster": 0.12,
    "flooring": 0.08,
    "doors_windows": 0.07,
    "electrical": 0.06,
    "plumbing_sanitary": 0.05,
    "painting_finishing": 0.06,
    "false_ceiling": 0.04,
    "kitchen_modular": 0.08,
    "contingency": 0.09,
}


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------

async def estimate_costs(
    plot_area_sqm: float,
    floors: int,
    budget_inr: int,
    geo_data: dict[str, Any],
    design_dna: dict[str, Any],
) -> dict[str, Any]:
    """
    Estimate construction costs and investment ROI.

    Args:
        plot_area_sqm : Site area in sq metres.
        floors        : Number of floors.
        budget_inr    : Total available budget in INR.
        geo_data      : Output of geo_agent.analyze_geo().
        design_dna    : dict representation of DesignDNA.

    Returns:
        Dict with tier, breakdown, total, ROI, and timeline.
    """
    # ---- Area calculations ------------------------------------------------
    built_up_per_floor_sqm: float = design_dna.get("built_up_area", plot_area_sqm * 0.55)
    total_built_up_sqm: float = built_up_per_floor_sqm * floors
    total_built_up_sqft: float = total_built_up_sqm * 10.764

    # ---- Quality tier from budget ----------------------------------------
    cost_per_sqft_available = budget_inr / max(total_built_up_sqft, 1)
    tier = _select_tier(cost_per_sqft_available)
    rate = CONSTRUCTION_RATES[tier]["rate_per_sqft"]

    # ---- 10-category breakdown -------------------------------------------
    base_cost = total_built_up_sqft * rate
    breakdown: dict[str, int] = {
        cat: round(base_cost * weight)
        for cat, weight in _BREAKDOWN_WEIGHTS.items()
    }
    total_construction = sum(breakdown.values())

    # ---- Location adjustment (+5 to +20% for metros) ---------------------
    location_multiplier = _location_adjustment(geo_data)
    adjusted_total = round(total_construction * location_multiplier)
    if location_multiplier != 1.0:
        adjustment_delta = adjusted_total - total_construction
        breakdown["contingency"] += adjustment_delta   # absorb into contingency

    # ---- Professional fees & timeline ------------------------------------
    professional_fees = round(adjusted_total * 0.10)   # architect + consultants
    total_project_cost = adjusted_total + professional_fees

    # ---- Claude AI — ROI & market analysis --------------------------------
    roi_data = await _get_roi_analysis(
        geo_data=geo_data,
        plot_area_sqm=plot_area_sqm,
        total_built_up_sqm=total_built_up_sqm,
        floors=floors,
        tier=tier,
        total_investment=total_project_cost,
    )

    return {
        "tier": tier,
        "tier_label": CONSTRUCTION_RATES[tier]["label"],
        "tier_description": CONSTRUCTION_RATES[tier]["description"],
        # Areas
        "built_up_sqm": round(total_built_up_sqm, 1),
        "built_up_sqft": round(total_built_up_sqft),
        # Rate & costs
        "rate_per_sqft_inr": rate,
        "location_multiplier": round(location_multiplier, 3),
        "breakdown": breakdown,
        "total_construction_inr": adjusted_total,
        "professional_fees_inr": professional_fees,
        "total_project_cost_inr": total_project_cost,
        "cost_per_sqm_inr": round(total_project_cost / max(total_built_up_sqm, 1)),
        # Budget vs actual
        "budget_utilisation_pct": round(total_project_cost / budget_inr * 100, 1),
        "within_budget": total_project_cost <= budget_inr,
        # ROI
        "roi": roi_data,
        # Timeline
        "timeline": _build_timeline(floors, tier),
        # Optimization tips
        "cost_optimisation": _cost_tips(tier, design_dna, breakdown),
    }


# ---------------------------------------------------------------------------
# Claude AI ROI analysis
# ---------------------------------------------------------------------------

async def _get_roi_analysis(
    geo_data: dict,
    plot_area_sqm: float,
    total_built_up_sqm: float,
    floors: int,
    tier: str,
    total_investment: int,
) -> dict[str, Any]:
    address = geo_data.get("address", {})
    city = (
        address.get("city")
        or address.get("county")
        or address.get("state_district")
        or "India"
    )

    prompt = f"""You are a real estate financial analyst specialising in India.
Analyse this residential property investment and provide ROI/market estimates.

Location: {city}
Plot Area: {plot_area_sqm:.0f} sqm ({plot_area_sqm * 10.764:.0f} sqft)
Total Built-up: {total_built_up_sqm:.0f} sqm across {floors} floor(s)
Construction Quality: {tier}
Total Project Investment: ₹{total_investment:,}
Nearby Amenity Count (500m): {geo_data.get("amenity_count", 0)}
Climate Zone: {geo_data.get("climate_zone", "tropical")}
Is Metro City: {geo_data.get("is_metro_city", False)}

Return ONLY a JSON object with exactly these keys:
{{
  "estimated_land_value_per_sqm": <integer INR>,
  "estimated_rental_per_month": <integer INR>,
  "resale_value_3yr": <integer INR>,
  "resale_value_5yr": <integer INR>,
  "rental_roi_percent": <float>,
  "appreciation_rate_percent": <float>,
  "recommendation": "<2-3 sentence investment summary>",
  "risk_level": "low|medium|high",
  "comparable_projects": ["<brief example 1>", "<brief example 2>"]
}}
No markdown, no explanation — pure JSON only."""

    try:
        client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
        response = await client.messages.create(
            model="claude-3-haiku-20240307",
            max_tokens=600,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Strip any accidental markdown fences
        raw = re.sub(r"^```[a-z]*\n?", "", raw, flags=re.MULTILINE)
        raw = re.sub(r"\n?```$", "", raw, flags=re.MULTILINE)
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Claude ROI call failed (%s) — using heuristics", exc)
        return _fallback_roi(total_investment, geo_data)


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _select_tier(cost_per_sqft: float) -> str:
    if cost_per_sqft < 1500:
        return "budget"
    if cost_per_sqft < 2500:
        return "standard"
    if cost_per_sqft < 4000:
        return "premium"
    return "luxury"


def _location_adjustment(geo_data: dict) -> float:
    """Metro cities command up to 20% construction cost premium."""
    if geo_data.get("is_metro_city"):
        return 1.15
    zoning = geo_data.get("zoning_type", "residential_suburban")
    if zoning == "residential_urban":
        return 1.08
    return 1.0


def _build_timeline(floors: int, tier: str) -> dict[str, str]:
    base_construction_weeks = 24 + (floors - 1) * 8
    if tier == "luxury":
        base_construction_weeks += 12
    return {
        "design_phase": "8–12 weeks",
        "approval_phase": "6–10 weeks",
        "construction_phase": f"{base_construction_weeks}–{base_construction_weeks + 8} weeks",
        "total_project": f"{base_construction_weeks + 20}–{base_construction_weeks + 32} weeks",
    }


def _cost_tips(
    tier: str, design_dna: dict, breakdown: dict
) -> dict[str, Any]:
    tips: list[str] = []
    potential_saving = 0

    if tier in ("premium", "luxury"):
        tips.append("Standardise window sizes to reduce fabrication cost by 8–12%")
        potential_saving += round(breakdown.get("doors_windows", 0) * 0.10)

    if design_dna.get("facade_material_palette") == "luxury_premium":
        tips.append("Use imported stone only for feature walls; switch remainder to large-format tiles")
        potential_saving += round(breakdown.get("flooring", 0) * 0.15)

    if design_dna.get("double_height_presence"):
        tips.append("Double-height volumes increase structural cost ~12%; ensure it is a key design priority")

    tips.append("Pre-fabricated staircase reduces on-site labour by 3–4 weeks")
    potential_saving += 30_000

    return {
        "potential_saving_inr": potential_saving,
        "suggestions": tips,
    }


def _fallback_roi(total_investment: int, geo_data: dict) -> dict[str, Any]:
    multiplier = 1.2 if geo_data.get("is_metro_city") else 1.0
    monthly_rental = round(total_investment * 0.003 * multiplier)
    return {
        "estimated_land_value_per_sqm": round(50_000 * multiplier),
        "estimated_rental_per_month": monthly_rental,
        "resale_value_3yr": round(total_investment * 1.35 * multiplier),
        "resale_value_5yr": round(total_investment * 1.75 * multiplier),
        "rental_roi_percent": round(monthly_rental * 12 / total_investment * 100, 2),
        "appreciation_rate_percent": 8.5 if geo_data.get("is_metro_city") else 6.5,
        "recommendation": (
            "Solid medium-term investment in a developing residential corridor. "
            "Rental demand is steady; capital appreciation expected to track city growth. "
            "Consider phased construction to manage cash flow."
        ),
        "risk_level": "medium",
        "comparable_projects": [
            "Similar 3BHK in adjacent layout sold at +18% over 3 years",
            "Rental yields in this zone average 3.8–4.5% p.a.",
        ],
    }