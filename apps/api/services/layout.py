"""
LayoutService — Stub for Phase 4.

Will generate 3 layout configurations (Compact, Courtyard, Tower)
from parcel geometry + feasibility data using geometric algorithms.
"""
from __future__ import annotations

from models.project import LayoutConfig, PlotInput


class LayoutService:
    """
    Generates three architecturally distinct building layout configurations:
      - COMPACT:   Single efficient block, maximised floor count
      - COURTYARD: Perimeter blocks forming an interior court
      - TOWER:     Slender tower on podium
    """

    async def generate(self, payload: PlotInput) -> list[LayoutConfig]:
        """
        Generate 3 layout options for the given parcel.
        Internally calls FeasibilityService then applies geometric layout engines.
        """
        # ── Phase 4: implement layout generation engines ─────────────
        raise NotImplementedError(
            "LayoutService.generate() will be implemented in Phase 4."
        )
