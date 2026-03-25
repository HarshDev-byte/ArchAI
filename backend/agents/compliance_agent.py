"""
Compliance Agent — ArchAI
Checks a design against Indian building regulations:
  - UDCPR 2020 (Unified Development Control & Promotion Regulations)
  - NBC 2016  (National Building Code of India)
  - BIS local bye-laws (approximated by zoning type)

All checks are deterministic — no AI calls required.
"""
from __future__ import annotations
import logging
from typing import Any

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Regulation tables
# ---------------------------------------------------------------------------

# Minimum setbacks (metres) by plot category
_SETBACKS: dict[str, dict[str, float]] = {
    "small":   {"front": 3.00, "side": 1.50, "rear": 2.00},  # < 500 sqm
    "medium":  {"front": 4.50, "side": 2.25, "rear": 3.00},  # 500–2000 sqm
    "large":   {"front": 6.00, "side": 3.00, "rear": 4.50},  # > 2000 sqm
}

# Max permissible height (m) without special clearance
_MAX_HEIGHTS: dict[int, float] = {
    1: 10.0, 2: 12.0, 3: 15.0, 4: 18.0, 5: 24.0,
}

# Min room areas (sqm) — NBC 2016 Table 8
_MIN_ROOM_AREAS: dict[str, float] = {
    "living": 9.5, "dining": 7.5, "kitchen": 4.5,
    "bedroom": 9.5, "bathroom": 1.8, "utility": 1.5,
}

# Ground coverage limits by zoning
_MAX_COVERAGE: dict[str, float] = {
    "residential_rural": 0.40,
    "residential_suburban": 0.45,
    "residential_urban": 0.55,
    "commercial_mixed": 0.65,
}


# ---------------------------------------------------------------------------
# Public entry-point
# ---------------------------------------------------------------------------

async def check_compliance(
    plot_area_sqm: float,
    floors: int,
    design_dna: dict[str, Any],
    geo_data: dict[str, Any],
) -> dict[str, Any]:
    """
    Run all compliance checks and return a structured report.

    Args:
        plot_area_sqm : Site area in sq metres.
        floors        : Number of floors.
        design_dna    : dict from DesignDNA.
        geo_data      : Output of geo_agent.analyze_geo().

    Returns:
        Dict with passed flag, per-check results, issues, warnings, score.
    """
    fsi_allowed = geo_data.get("fsi_allowed", 1.5)
    built_up_per_floor: float = design_dna.get("built_up_area", plot_area_sqm * 0.55)
    total_built_up: float = built_up_per_floor * floors
    fsi_used: float = total_built_up / plot_area_sqm
    floor_height: float = design_dna.get("floor_height", 3.0)
    max_height_m: float = floors * floor_height
    setback_front: float = design_dna.get("setback_front", 3.0)
    setback_side: float = design_dna.get("setback_sides", 1.5)
    coverage: float = built_up_per_floor / plot_area_sqm
    zoning: str = geo_data.get("zoning_type", "residential_suburban")
    flooding: str = geo_data.get("flood_risk", "low")

    issues: list[str] = []
    warnings: list[str] = []
    checks: dict[str, dict] = {}

    # --- 1. FSI / FAR -------------------------------------------------------
    fsi_ok = fsi_used <= fsi_allowed
    over_sqm = max(0.0, (fsi_used - fsi_allowed) * plot_area_sqm)
    if not fsi_ok:
        issues.append(
            f"FSI violation: used {fsi_used:.2f}, allowed {fsi_allowed:.2f}. "
            f"Reduce total built-up by {over_sqm:.0f} sqm."
        )
    checks["fsi"] = {
        "label": "Floor Space Index (FSI / FAR)",
        "fsi_used": round(fsi_used, 3),
        "fsi_allowed": fsi_allowed,
        "passed": fsi_ok,
        "overage_sqm": round(over_sqm, 1),
    }

    # --- 2. Setbacks --------------------------------------------------------
    plot_cat = "small" if plot_area_sqm < 500 else ("medium" if plot_area_sqm < 2000 else "large")
    req = _SETBACKS[plot_cat]

    front_ok = setback_front >= req["front"]
    side_ok = setback_side >= req["side"]
    if not front_ok:
        issues.append(
            f"Front setback: {setback_front:.1f}m given, {req['front']}m required "
            f"(UDCPR 2020, plot category '{plot_cat}')."
        )
    if not side_ok:
        issues.append(
            f"Side setback: {setback_side:.1f}m given, {req['side']}m required."
        )
    checks["setbacks"] = {
        "label": "Setback Requirements (UDCPR 2020)",
        "front": {"given": setback_front, "required": req["front"], "passed": front_ok},
        "side": {"given": setback_side, "required": req["side"], "passed": side_ok},
        "rear_required": req["rear"],
        "passed": front_ok and side_ok,
    }

    # --- 3. Building height -------------------------------------------------
    max_allowed_height = _MAX_HEIGHTS.get(floors, floors * 3.5)
    height_ok = max_height_m <= max_allowed_height
    if not height_ok:
        warnings.append(
            f"Building height {max_height_m:.1f}m exceeds {max_allowed_height}m limit "
            f"for {floors}-storey structures — may require NOC from fire department."
        )
    checks["height"] = {
        "label": "Building Height (NBC 2016)",
        "height_m": round(max_height_m, 1),
        "max_allowed_m": max_allowed_height,
        "passed": height_ok,
    }

    # --- 4. Ground coverage -------------------------------------------------
    max_cov = _MAX_COVERAGE.get(zoning, 0.50)
    coverage_ok = coverage <= max_cov
    if not coverage_ok:
        issues.append(
            f"Ground coverage {coverage*100:.1f}% exceeds {max_cov*100:.0f}% "
            f"limit for zone '{zoning}'."
        )
    checks["coverage"] = {
        "label": "Ground Coverage",
        "coverage_pct": round(coverage * 100, 1),
        "max_allowed_pct": round(max_cov * 100),
        "passed": coverage_ok,
    }

    # --- 5. Parking ---------------------------------------------------------
    parking_required = max(1, int(total_built_up / 100))
    checks["parking"] = {
        "label": "Parking Requirement",
        "parking_spaces_required": parking_required,
        "note": "1 space per 100 sqm built-up (typical municipal norm)",
        "passed": True,   # informational — not a hard fail at design stage
    }
    warnings.append(
        f"Provide minimum {parking_required} parking space(s) "
        f"({total_built_up:.0f} sqm built-up)."
    )

    # --- 6. Green / open space ---------------------------------------------
    required_green = plot_area_sqm * 0.15
    available_green = max(0.0, plot_area_sqm - built_up_per_floor - setback_front * 5)
    green_ok = available_green >= required_green
    if not green_ok:
        warnings.append(
            f"Open/green area: {available_green:.0f} sqm available, "
            f"{required_green:.0f} sqm (15%) required."
        )
    checks["green_space"] = {
        "label": "Open / Green Area (15% norm)",
        "required_sqm": round(required_green, 1),
        "available_sqm": round(available_green, 1),
        "passed": green_ok,
    }

    # --- 7. Flood zone advisory ---------------------------------------------
    if flooding in ("high", "medium"):
        warnings.append(
            f"Flood risk is '{flooding}' — raise plinth level by "
            f"{'600mm' if flooding=='high' else '300mm'} above natural ground. "
            "Consult local drainage authority."
        )
    checks["flood_risk"] = {
        "label": "Flood Risk Advisory",
        "risk_level": flooding,
        "passed": flooding == "low",
    }

    # --- 8. Fire safety (height trigger) ------------------------------------
    fire_noc_required = max_height_m > 15.0
    if fire_noc_required:
        warnings.append(
            "Buildings > 15m require Fire NOC from State Fire Department "
            "(NBC Part 4, 2016)."
        )
    checks["fire_safety"] = {
        "label": "Fire Safety (NBC Part 4)",
        "noc_required": fire_noc_required,
        "passed": not fire_noc_required,
    }

    # --- Aggregate score ----------------------------------------------------
    passed_count = sum(1 for c in checks.values() if c.get("passed", True))
    compliance_score = round(passed_count / len(checks) * 100)
    overall_passed = len(issues) == 0

    return {
        "passed": overall_passed,
        "compliance_score_pct": compliance_score,
        "status": "compliant" if overall_passed else ("minor_issues" if compliance_score >= 70 else "non_compliant"),
        # Overview numbers
        "fsi_used": round(fsi_used, 3),
        "fsi_allowed": fsi_allowed,
        "max_height_m": round(max_height_m, 1),
        "ground_coverage_pct": round(coverage * 100, 1),
        "parking_required": parking_required,
        # Detailed checks
        "checks": checks,
        # Issues / warnings
        "issues": issues,
        "warnings": warnings,
        # Approval info
        "approval_pathway": _approval_pathway(issues, warnings, max_height_m, geo_data),
        "standards_reference": "UDCPR 2020 / NBC 2016 (India)",
    }


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------

def _approval_pathway(
    issues: list[str],
    warnings: list[str],
    height_m: float,
    geo_data: dict,
) -> dict[str, Any]:
    permits = ["Building Plan Sanction (local municipality)"]
    if height_m > 15:
        permits.append("Fire NOC (State Fire Department)")
    if geo_data.get("flood_risk") == "high":
        permits.append("Drainage / Flood Zone clearance")
    if geo_data.get("is_metro_city"):
        permits.append("Environment Clearance (if built-up > 20,000 sqm)")

    weeks_base = 8
    weeks_base += len(permits) * 3
    if len(issues) > 0:
        weeks_base += 6  # revisions needed

    return {
        "required_permits": permits,
        "estimated_timeline": f"{weeks_base}–{weeks_base + 8} weeks",
        "revision_required": len(issues) > 0,
        "likely_conditions": warnings[:3],
    }