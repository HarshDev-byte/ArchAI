"""
FeasibilityService — Stub for Phase 3.

Will call Claude claude-sonnet-4-6 with the parcel + location context
and parse structured JSON from the response.
"""
from __future__ import annotations

from models.project import FeasibilityResult, PlotInput, SetbackRequirements
from utils.geo import compute_parcel_area_sqm


class FeasibilityService:
    """
    Orchestrates the AI feasibility analysis pipeline:
      1. Compute parcel metrics (area, bounding box)
      2. Build Claude prompt (from prompts/feasibility.py)
      3. Call Claude claude-sonnet-4-6
      4. Parse + validate structured JSON response
      5. Return FeasibilityResult
    """

    async def analyse(self, payload: PlotInput) -> FeasibilityResult:
        """
        Run a feasibility check on the given parcel.
        Raises ValueError for invalid geometry, RuntimeError for AI failures.
        """
        area = compute_parcel_area_sqm(payload.parcel_geojson)

        # ── Phase 3: replace this stub with Claude call ──────────────
        raise NotImplementedError(
            "FeasibilityService.analyse() will be implemented in Phase 3. "
            f"Parcel area computed: {area:.1f} m²"
        )
