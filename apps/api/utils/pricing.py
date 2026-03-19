"""
utils/pricing.py

Indian real estate pricing constants used for construction cost and
sale revenue estimates in AI-generated layout configurations.

All prices are in Indian Rupees (INR) per square foot of built-up area.
Construction costs are typical Grade-A residential rates (2025).
Sale prices are indicative market rates — actual values vary by micro-market.
"""

from __future__ import annotations


# ─────────────────────────────────────────────────────────────────────────────
# City pricing table
# Key: lowercase city name (normalised)
# construction_per_sqft : typical all-in cost to build Grade-A residential
# sale_per_sqft         : indicative market sale rate for new residential
# ─────────────────────────────────────────────────────────────────────────────

CITY_PRICING: dict[str, dict[str, int]] = {
    "mumbai":        {"construction_per_sqft": 3800, "sale_per_sqft": 18_000},
    "navi mumbai":   {"construction_per_sqft": 3500, "sale_per_sqft": 13_000},
    "thane":         {"construction_per_sqft": 3400, "sale_per_sqft": 11_500},
    "pune":          {"construction_per_sqft": 2800, "sale_per_sqft":  9_500},
    "bangalore":     {"construction_per_sqft": 3200, "sale_per_sqft": 12_000},
    "bengaluru":     {"construction_per_sqft": 3200, "sale_per_sqft": 12_000},
    "hyderabad":     {"construction_per_sqft": 2600, "sale_per_sqft":  8_500},
    "secunderabad":  {"construction_per_sqft": 2600, "sale_per_sqft":  8_000},
    "delhi":         {"construction_per_sqft": 3500, "sale_per_sqft": 15_000},
    "new delhi":     {"construction_per_sqft": 3500, "sale_per_sqft": 15_000},
    "gurgaon":       {"construction_per_sqft": 3400, "sale_per_sqft": 14_000},
    "gurugram":      {"construction_per_sqft": 3400, "sale_per_sqft": 14_000},
    "noida":         {"construction_per_sqft": 3000, "sale_per_sqft": 10_500},
    "greater noida": {"construction_per_sqft": 2800, "sale_per_sqft":  8_500},
    "chennai":       {"construction_per_sqft": 2700, "sale_per_sqft":  9_000},
    "kolkata":       {"construction_per_sqft": 2500, "sale_per_sqft":  7_500},
    "ahmedabad":     {"construction_per_sqft": 2400, "sale_per_sqft":  7_000},
    "surat":         {"construction_per_sqft": 2500, "sale_per_sqft":  7_500},
    "jaipur":        {"construction_per_sqft": 2300, "sale_per_sqft":  6_500},
    "lucknow":       {"construction_per_sqft": 2400, "sale_per_sqft":  6_000},
    "kochi":         {"construction_per_sqft": 2800, "sale_per_sqft":  9_000},
    "coimbatore":    {"construction_per_sqft": 2400, "sale_per_sqft":  6_500},
    "indore":        {"construction_per_sqft": 2300, "sale_per_sqft":  5_500},
    "bhopal":        {"construction_per_sqft": 2200, "sale_per_sqft":  5_000},
    "nagpur":        {"construction_per_sqft": 2400, "sale_per_sqft":  6_000},
    "vizag":         {"construction_per_sqft": 2500, "sale_per_sqft":  6_500},
    "visakhapatnam": {"construction_per_sqft": 2500, "sale_per_sqft":  6_500},
}

# Fallback for unknown cities
DEFAULT_PRICING: dict[str, int] = {
    "construction_per_sqft": 3000,
    "sale_per_sqft":         9_000,
}

# Budget tier multipliers (applied to the base construction cost)
BUDGET_TIER_MULTIPLIER: dict[str, float] = {
    "budget":       0.80,   # lower spec finishes
    "mid_range":    1.00,   # standard Grade-A
    "premium":      1.25,
    "ultra_luxury": 1.55,
}

# Saleable area efficiency (net saleable / gross built-up)
EFFICIENCY_RATIO: float = 0.77   # ~77% of built-up is saleable after common areas


# ─────────────────────────────────────────────────────────────────────────────
# Public helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_pricing(city: str | None) -> dict[str, int]:
    """
    Return construction and sale pricing for a city.
    Falls back to DEFAULT_PRICING for unknown cities.
    """
    if not city:
        return DEFAULT_PRICING
    return CITY_PRICING.get(city.lower().strip(), DEFAULT_PRICING)


def estimate_financials(
    gross_built_sqft: float,
    city: str | None,
    budget_tier: str | None = "mid_range",
) -> dict[str, float]:
    """
    Estimate construction cost, sale revenue, and ROI for a layout.

    Args:
        gross_built_sqft : Total gross built-up area across all floors.
        city             : City name (used for pricing lookup).
        budget_tier      : One of budget / mid_range / premium / ultra_luxury.

    Returns:
        {construction_cost_inr, sale_revenue_inr, roi_pct, saleable_sqft}
    """
    pricing    = get_pricing(city)
    multiplier = BUDGET_TIER_MULTIPLIER.get(budget_tier or "mid_range", 1.0)

    construction_rate = pricing["construction_per_sqft"] * multiplier
    construction_cost = gross_built_sqft * construction_rate

    saleable_sqft  = gross_built_sqft * EFFICIENCY_RATIO
    sale_revenue   = saleable_sqft * pricing["sale_per_sqft"]

    roi_pct = ((sale_revenue - construction_cost) / construction_cost * 100) if construction_cost else 0

    return {
        "construction_cost_inr": round(construction_cost),
        "sale_revenue_inr":      round(sale_revenue),
        "roi_pct":               round(roi_pct, 1),
        "saleable_sqft":         round(saleable_sqft),
    }


def pricing_table_for_prompt(city: str | None) -> str:
    """Return a formatted one-line pricing summary for inclusion in an AI prompt."""
    p = get_pricing(city)
    return (
        f"Construction: ₹{p['construction_per_sqft']:,}/sqft · "
        f"Sale rate: ₹{p['sale_per_sqft']:,}/sqft · "
        f"Saleable efficiency: {EFFICIENCY_RATIO:.0%}"
    )
