"""
Sustainability Agent — ArchAI
Analyses solar potential (PVGIS, free), ventilation, shading,
rainwater, and produces a green score + IGBC-style rating.
"""
from __future__ import annotations
import asyncio
import logging
import math
from typing import Any

import httpx

logger = logging.getLogger(__name__)

PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_2/PVcalc"

# Ventilation effectiveness scores (0-100)
_VENTILATION_SCORES: dict[str, int] = {
    "cross_ventilation": 95, "courtyard_draft": 90,
    "stack_effect": 85, "wind_catcher": 80,
}

# Material sustainability (carbon, recyclability, durability: 0-1)
_MATERIAL_DB: dict[str, dict[str, float]] = {
    "warm_earthy":      {"carbon": 0.75, "recycle": 0.60, "durability": 0.85},
    "cool_modern":      {"carbon": 0.55, "recycle": 0.80, "durability": 0.90},
    "natural_organic":  {"carbon": 0.90, "recycle": 0.70, "durability": 0.75},
    "luxury_premium":   {"carbon": 0.50, "recycle": 0.65, "durability": 0.95},
    "sustainable_green":{"carbon": 0.95, "recycle": 0.90, "durability": 0.70},
}


async def analyze_sustainability(
    latitude: float,
    longitude: float,
    plot_area_sqm: float,
    floors: int,
    design_dna: dict[str, Any],
    geo_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Comprehensive sustainability analysis.

    Returns green score (0-100), IGBC-style rating, solar savings,
    ventilation, shading, water harvesting, and actionable recommendations.
    """
    roof_area: float = design_dna.get("built_up_area", plot_area_sqm * 0.55)
    panel_area: float = roof_area * 0.60          # 60% roof usable for solar

    # Parallel: PVGIS + climate lookups (PVGIS may be slow)
    solar_data = await _get_pvgis(latitude, longitude, panel_area)

    # --- Ventilation --------------------------------------------------------
    vent_strategy: str = design_dna.get("natural_ventilation_strategy", "cross_ventilation")
    vent_score: int = _VENTILATION_SCORES.get(vent_strategy, 70)

    # --- Shading ------------------------------------------------------------
    shading_coeff: float = design_dna.get("shading_coefficient", 0.5)
    cooling_reduction_pct: float = round(shading_coeff * 30, 1)

    # --- Rainwater ----------------------------------------------------------
    annual_rainfall_mm: int = geo_data.get("annual_rainfall_mm", 800)
    rainwater_kl: float = round(roof_area * annual_rainfall_mm * 0.80 / 1000, 1)

    # --- Material sustainability --------------------------------------------
    palette: str = design_dna.get("facade_material_palette", "warm_earthy")
    mat = _MATERIAL_DB.get(palette, _MATERIAL_DB["warm_earthy"])
    material_score: float = round((mat["carbon"] + mat["recycle"] + mat["durability"]) / 3, 3)

    # --- WWR (daylighting bonus) --------------------------------------------
    wwr: float = design_dna.get("window_wall_ratio", 0.40)
    daylight_score: float = min(100.0, wwr * 120)  # 0.4 → 48, 0.6 → 72

    # --- Courtyard bonus ----------------------------------------------------
    courtyard_bonus: float = 5.0 if design_dna.get("courtyard_presence") else 0.0

    # --- Aggregate green score (0-100) ------------------------------------
    green_score = round(
        solar_data.get("solar_score", 70) * 0.25
        + vent_score * 0.25
        + (shading_coeff * 100) * 0.20
        + min(100, rainwater_kl * 5) * 0.10
        + material_score * 100 * 0.15
        + daylight_score * 0.05
        + courtyard_bonus
    )
    green_score = min(100, max(0, green_score))

    # --- Embodied carbon estimate ------------------------------------------
    built_up_total = roof_area * floors
    embodied_carbon_t = round(built_up_total * _embodied_carbon_kg_sqm(palette) / 1000, 1)

    return {
        "green_score": green_score,
        "green_rating": _to_rating(green_score),
        "igbc_equivalent": _igbc_rating(green_score),
        # Solar
        "solar": {
            "panel_area_sqm": round(panel_area, 1),
            "peak_power_kwp": round(panel_area * 0.20, 1),
            "annual_generation_kwh": solar_data.get("annual_kwh", round(panel_area * 1400)),
            "monthly_savings_inr": round(
                solar_data.get("annual_kwh", panel_area * 1400) / 12 * 8
            ),
            "payback_years": round(
                panel_area * 40_000 / max(solar_data.get("annual_kwh", panel_area * 1400) * 8, 1),
                1,
            ),
            "solar_score": solar_data.get("solar_score", 70),
        },
        # Ventilation
        "ventilation": {
            "strategy": vent_strategy,
            "effectiveness_score": vent_score,
            "ac_reduction_pct": round(vent_score * 0.40),
        },
        # Shading
        "shading": {
            "coefficient": shading_coeff,
            "cooling_load_reduction_pct": cooling_reduction_pct,
            "facade_pattern": design_dna.get("facade_pattern", ""),
        },
        # Water
        "water": {
            "rainwater_potential_kl_yr": rainwater_kl,
            "annual_saving_potential_inr": round(rainwater_kl * 50),  # ₹50/kL
            "greywater_recycling_possible": bool(design_dna.get("courtyard_presence")) or floors > 1,
        },
        # Materials
        "materials": {
            "palette": palette,
            "sustainability_score": round(material_score * 100, 1),
            "carbon_score": round(mat["carbon"] * 100, 1),
            "embodied_carbon_tonnes": embodied_carbon_t,
        },
        # Recommendations
        "recommendations": _recommendations(design_dna, geo_data, solar_data, green_score),
        # Certifications
        "certifications": {
            "igbc": _igbc_rating(green_score),
            "griha_stars": _griha_stars(green_score),
            "leed_equivalent": _leed_rating(green_score),
        },
    }


# ---------------------------------------------------------------------------
# PVGIS solar data
# ---------------------------------------------------------------------------

async def _get_pvgis(lat: float, lon: float, panel_area: float) -> dict[str, Any]:
    peak_kw = panel_area * 0.20
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(PVGIS_URL, params={
                "lat": lat, "lon": lon,
                "peakpower": round(peak_kw, 2),
                "loss": 14, "outputformat": "json",
                "mountingplace": "building", "optimalangles": 1,
            })
            resp.raise_for_status()
            data = resp.json()
            annual_kwh = (
                data.get("outputs", {})
                    .get("totals", {})
                    .get("fixed", {})
                    .get("E_y", panel_area * 1400)
            )
            annual_kwh = round(float(annual_kwh))
            solar_score = min(100, round(annual_kwh / (panel_area * 15)))
            return {"annual_kwh": annual_kwh, "solar_score": solar_score}
    except Exception as exc:
        logger.warning("PVGIS call failed (%s) — using estimate", exc)
        annual_kwh = round(panel_area * 1400)
        return {"annual_kwh": annual_kwh, "solar_score": 72}


# ---------------------------------------------------------------------------
# Rating helpers
# ---------------------------------------------------------------------------

def _to_rating(score: int) -> str:
    if score >= 85: return "Platinum"
    if score >= 70: return "Gold"
    if score >= 55: return "Silver"
    return "Bronze"

def _igbc_rating(score: int) -> str:
    """Approximate IGBC Green Homes rating."""
    if score >= 90: return "Platinum (90-100 pts)"
    if score >= 75: return "Gold (75-89 pts)"
    if score >= 60: return "Silver (60-74 pts)"
    if score >= 50: return "Certified (50-59 pts)"
    return "Not Certified"

def _griha_stars(score: int) -> str:
    stars = max(1, min(5, round(score / 20)))
    return f"{'★' * stars}{'☆' * (5 - stars)} ({stars}/5)"

def _leed_rating(score: int) -> str:
    if score >= 85: return "Platinum"
    if score >= 70: return "Gold"
    if score >= 55: return "Silver"
    return "Certified"

def _embodied_carbon_kg_sqm(palette: str) -> float:
    """Approximate embodied carbon kg CO₂e per sqm by material palette."""
    return {
        "warm_earthy": 320, "cool_modern": 450,
        "natural_organic": 200, "luxury_premium": 500,
        "sustainable_green": 180,
    }.get(palette, 350)


# ---------------------------------------------------------------------------
# Recommendations engine
# ---------------------------------------------------------------------------

def _recommendations(
    dna: dict, geo: dict, solar: dict, score: int
) -> list[str]:
    recs: list[str] = []
    shading = dna.get("shading_coefficient", 0.5)
    wwr = dna.get("window_wall_ratio", 0.4)
    climate = geo.get("climate_zone", "tropical")
    annual_kwh = solar.get("annual_kwh", 0)

    if shading < 0.45 and climate in ("tropical", "hot_humid", "hot_dry"):
        recs.append(
            "Add brise-soleil, jaali screens, or horizontal louvers to cut solar heat gain by 25–35%."
        )
    if not dna.get("courtyard_presence") and dna.get("plot_area", 500) > 1200:
        recs.append(
            "A central courtyard can reduce indoor temperature by 3–5°C through stack-effect ventilation."
        )
    if wwr > 0.60:
        recs.append(
            "High glazing ratio detected — specify double-glazed low-e glass (U ≤ 1.8 W/m²K) to cap heat ingress."
        )
    if annual_kwh > 5000:
        recs.append(
            f"Rooftop solar ({dna.get('built_up_area',0)*0.6:.0f} sqm panel area) "
            f"can generate ≈{annual_kwh:,} kWh/yr — offsetting 60–80% of electricity bills."
        )
    if dna.get("rooftop_utility") != "solar_farm":
        recs.append(
            "Designating rooftop as solar farm can save ₹"
            f"{round(annual_kwh/12*8):,}/month on electricity."
        )
    recs.append(
        f"Rainwater harvesting can capture ≈{geo.get('annual_rainfall_mm',800)*dna.get('built_up_area',100)*0.8/1000:.0f} kL/year — "
        "install 3-stage filter + underground sump."
    )
    if score < 70:
        recs.append(
            "Consider switching facade palette to 'sustainable_green' (bamboo, rammed earth, solar tiles) "
            "to gain +8–12 green score points."
        )
    return recs[:6]