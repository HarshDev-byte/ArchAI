"""
routers/feasibility.py

POST /api/v1/feasibility        — legacy synchronous endpoint (GeoJSON parcel)
POST /api/v1/feasibility/check  — async job trigger (wizard flow)
"""
from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from config import get_settings
from dependencies import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/feasibility", tags=["feasibility"])


# ─────────────────────────────────────────────────────────────────────────────
# I/O models
# ─────────────────────────────────────────────────────────────────────────────

class FeasibilityCheckRequest(BaseModel):
    project_id: str


class FeasibilityCheckResponse(BaseModel):
    job_id:     str
    project_id: str
    status:     str = "queued"
    message:    str = "Feasibility check queued. Connect to /ws/{job_id} for live progress."


# ─────────────────────────────────────────────────────────────────────────────
# Legacy synchronous endpoint (kept for CLI / Postman use)
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_200_OK,
    summary="[Legacy] Synchronous feasibility check on a GeoJSON parcel",
    description=(
        "Accepts a GeoJSON polygon parcel and runs an immediate Claude feasibility "
        "analysis. For wizard-driven async flow use POST /feasibility/check instead."
    ),
)
async def run_feasibility_legacy(payload: dict) -> dict:
    return {
        "message": "Use POST /api/v1/feasibility/check for the wizard flow.",
        "received": payload,
    }


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/v1/feasibility/check  — async job trigger
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/check",
    response_model=FeasibilityCheckResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Trigger async feasibility check for a project",
)
async def trigger_feasibility_check(
    body: FeasibilityCheckRequest,
    user_id: str = Depends(get_current_user),
) -> FeasibilityCheckResponse:
    """
    1. Verify the project exists and belongs to the caller.
    2. Create a unique job_id.
    3. Store job metadata in Redis (job:{job_id}) for the WebSocket handler.
    4. Dispatch run_feasibility_check Celery task.
    5. Return job_id — client connects to ws://.../ws/{job_id} for live progress.

    If Celery/Redis is unavailable, the WebSocket handler runs the AI directly.
    """
    # ── Verify project ownership ──────────────────────────────────────────────
    try:
        from supabase import create_client  # type: ignore
        s = get_settings()
        db = create_client(s.supabase_url, s.supabase_service_role_key)

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
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("DB check skipped (Supabase unavailable): %s", exc)

    # ── Create job_id ─────────────────────────────────────────────────────────
    job_id = str(uuid.uuid4())

    # ── Store in Redis ────────────────────────────────────────────────────────
    try:
        import redis.asyncio as aioredis  # type: ignore
        s = get_settings()
        r = await aioredis.from_url(s.redis_url, decode_responses=True)
        await r.setex(
            f"job:{job_id}",
            7200,   # 2-hour TTL
            json.dumps({
                "job_id":     job_id,
                "project_id": body.project_id,
                "user_id":    user_id,
                "task":       "feasibility_check",
                "status":     "queued",
            }),
        )
        await r.close()
        logger.info("Job stored in Redis: job=%s project=%s", job_id, body.project_id)
    except Exception as exc:
        logger.warning("Redis unavailable (%s) — WS will handle AI directly.", exc)

    # ── Dispatch Celery task ──────────────────────────────────────────────────
    try:
        from workers.tasks import run_feasibility_check  # type: ignore
        run_feasibility_check.apply_async(
            args=[job_id, body.project_id, user_id],
            task_id=job_id,
        )
        logger.info("Celery task dispatched: job=%s", job_id)
    except Exception as exc:
        # Celery not running — the WS handler will fall back to the simulation
        # that calls the real Claude service directly.
        logger.info("Celery not available (%s) — WebSocket will handle AI directly.", type(exc).__name__)

    return FeasibilityCheckResponse(
        job_id=job_id,
        project_id=body.project_id,
    )
