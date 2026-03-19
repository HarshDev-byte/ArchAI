"""
ProjectService — Stub for Supabase CRUD.
"""
from __future__ import annotations

from datetime import datetime, timezone


class ProjectService:
    """Persist and retrieve projects via Supabase."""

    async def create(
        self, name: str, parcel_geojson: dict | None = None
    ) -> dict:
        # ── Wire Supabase client here in Phase 5 ────────────────────
        raise NotImplementedError("ProjectService.create() — Phase 5")

    async def get(self, project_id: str) -> dict | None:
        # ── Wire Supabase client here in Phase 5 ────────────────────
        raise NotImplementedError("ProjectService.get() — Phase 5")
