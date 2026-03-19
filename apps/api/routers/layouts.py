"""
routers/layouts.py

POST /api/v1/layouts/generate         — trigger async layout generation
GET  /api/v1/layouts/{project_id}     — list all layouts for a project
POST /api/v1/layouts/{layout_id}/select — set is_selected=true, unselect others
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from dependencies import get_current_user
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/layouts", tags=["layouts"])


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic I/O models
# ─────────────────────────────────────────────────────────────────────────────

class LayoutGenerateRequest(BaseModel):
    project_id: str


class LayoutGenerateResponse(BaseModel):
    job_id: str
    project_id: str
    status: str = "queued"
    message: str = "Layout generation queued. Connect to /ws/{job_id} for live progress."


class LayoutRecord(BaseModel):
    id: str
    project_id: str
    design_seed: int | None = None
    concept_name: str | None = None
    floor_plan: dict[str, Any] | None = None
    unit_mix: Any = None
    amenities: dict[str, Any] | None = None
    geometry_hints: dict[str, Any] | None = None
    total_units: int | None = None
    construction_cost_inr: float | None = None
    sale_revenue_inr: float | None = None
    roi_pct: float | None = None
    is_selected: bool = False
    created_at: str | None = None


class LayoutListResponse(BaseModel):
    layouts: list[LayoutRecord]
    project_id: str
    total: int


class SelectLayoutResponse(BaseModel):
    layout_id: str
    project_id: str
    is_selected: bool = True
    message: str


# ─────────────────────────────────────────────────────────────────────────────
# Supabase helper
# ─────────────────────────────────────────────────────────────────────────────

def _supabase():
    from supabase import create_client  # type: ignore
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


async def _supabase_async():
    from supabase import acreate_client  # type: ignore
    s = get_settings()
    return await acreate_client(s.supabase_url, s.supabase_service_role_key)


def _store_job_in_redis(job_id: str, project_id: str, user_id: str, task_type: str) -> None:
    """Store job metadata in Redis so the WebSocket handler can look it up."""
    try:
        import redis  # type: ignore
        r = redis.from_url(get_settings().redis_url, decode_responses=True)
        r.setex(f"job:{job_id}", 3600, json.dumps({
            "job_id":     job_id,
            "project_id": project_id,
            "user_id":    user_id,
            "task":       task_type,
            "status":     "queued",
        }))
        r.close()
    except Exception as exc:
        logger.warning("Redis job store skipped: %s", exc)


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/layouts/generate
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/generate",
    response_model=LayoutGenerateResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger async layout generation for an approved project",
)
async def trigger_layout_generation(
    body: LayoutGenerateRequest,
    user_id: str = Depends(get_current_user),
) -> LayoutGenerateResponse:
    """
    Checks that the project's feasibility report shows is_feasible=true,
    then queues a Celery task for layout generation.
    Returns a job_id to subscribe to via WebSocket.
    """
    db = _supabase()

    # ── Ownership check ──────────────────────────────────────────────────────
    proj_resp = (
        db.table("projects")
        .select("id, user_id, status")
        .eq("id", body.project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not proj_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{body.project_id}' not found or you don't have access.",
        )

    # ── Feasibility gate ─────────────────────────────────────────────────────
    fr_resp = (
        db.table("feasibility_reports")
        .select("is_feasible")
        .eq("project_id", body.project_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not fr_resp.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No feasibility report found for this project. Run /feasibility/check first.",
        )

    if not fr_resp.data[0].get("is_feasible"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project is not feasible. Fix the plot/requirements before generating layouts.",
        )

    # ── Create job ───────────────────────────────────────────────────────────
    job_id = str(uuid.uuid4())
    _store_job_in_redis(job_id, body.project_id, user_id, "layout_generation")

    # ── Dispatch Celery task ─────────────────────────────────────────────────
    try:
        from workers.tasks import run_layout_generation  # type: ignore
        run_layout_generation.apply_async(
            args=[job_id, body.project_id, user_id],
            task_id=job_id,
        )
        logger.info("Layout task dispatched: job=%s project=%s", job_id, body.project_id)
    except Exception as exc:
        logger.warning("Celery not available (%s). WS will handle generation directly.", exc)

    return LayoutGenerateResponse(job_id=job_id, project_id=body.project_id)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/v1/layouts/{project_id}
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/{project_id}",
    response_model=LayoutListResponse,
    summary="List all generated layout configurations for a project",
)
async def list_layouts(
    project_id: str,
    user_id: str = Depends(get_current_user),
) -> LayoutListResponse:
    db = _supabase()

    # ownership check
    proj_resp = (
        db.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not proj_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found or you don't have access.",
        )

    lc_resp = (
        db.table("layout_configurations")
        .select("*")
        .eq("project_id", project_id)
        .order("design_seed")
        .execute()
    )

    layouts = [LayoutRecord(**row) for row in (lc_resp.data or [])]
    return LayoutListResponse(
        layouts=layouts,
        project_id=project_id,
        total=len(layouts),
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/layouts/{layout_id}/select
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/{layout_id}/select",
    response_model=SelectLayoutResponse,
    summary="Set this layout as selected, unselect all others for the same project",
)
async def select_layout(
    layout_id: str,
    user_id: str = Depends(get_current_user),
) -> SelectLayoutResponse:
    db = _supabase()

    # ── Fetch the target layout to get project_id ─────────────────────────────
    lc_resp = (
        db.table("layout_configurations")
        .select("id, project_id")
        .eq("id", layout_id)
        .maybe_single()
        .execute()
    )
    if not lc_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Layout '{layout_id}' not found.",
        )

    project_id = lc_resp.data["project_id"]

    # ── Ownership check via project ──────────────────────────────────────────
    proj_resp = (
        db.table("projects")
        .select("id")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not proj_resp.data:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this project.",
        )

    # ── Unselect all layouts for this project ─────────────────────────────────
    db.table("layout_configurations").update({
        "is_selected": False,
    }).eq("project_id", project_id).execute()

    # ── Select the target layout ──────────────────────────────────────────────
    db.table("layout_configurations").update({
        "is_selected": True,
    }).eq("id", layout_id).execute()

    # ── Update project status ─────────────────────────────────────────────────
    db.table("projects").update({
        "status": "layouts_generated",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", project_id).execute()

    logger.info("Layout selected: layout=%s project=%s user=%s", layout_id, project_id, user_id)

    return SelectLayoutResponse(
        layout_id=layout_id,
        project_id=project_id,
        is_selected=True,
        message=f"Layout '{layout_id}' selected. All other layouts for this project have been deselected.",
    )
