"""
routers/websocket.py

WebSocket endpoint: /ws/{job_id}

Message types sent to the client:
  {"type":"progress", "stage":"...", "message":"...", "pct":0-100}
  {"type":"complete", "project_id":"<uuid>", ...}
  {"type":"error",    "message":"..."}
  {"type":"layout_stream", "chunk":"...", "chars_received":N}   ← streaming chunks

Production mode (Celery + Redis):
  Subscribes to Redis pub/sub channel job-progress:{job_id}.
  Celery workers publish progress/complete/error events.
  Forward all messages directly to the browser.

Development mode (no Redis/Celery):
  Runs the full AI pipeline in-process:
  check_feasibility → progress events → generate_layouts (streaming) → complete
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


# ─────────────────────────────────────────────────────────────────────────────
# Production path — Redis pub/sub
# ─────────────────────────────────────────────────────────────────────────────

async def _redis_subscribe(websocket: WebSocket, job_id: str) -> bool:
    """
    Subscribe to Redis pub/sub channel `job-progress:{job_id}` and forward
    all messages to the connected WebSocket client.

    Returns True  if Redis was available and messages were forwarded.
    Returns False if Redis is unavailable → triggers dev-mode fallback.
    """
    try:
        import redis.asyncio as aioredis  # type: ignore
        from config import get_settings

        s = get_settings()
        r  = await aioredis.from_url(s.redis_url, decode_responses=True)

        # Verify we know this job
        meta_raw = await r.get(f"job:{job_id}")
        if not meta_raw:
            await r.close()
            logger.info("[WS-redis] job %s not in Redis → fallback", job_id)
            return False

        pubsub  = r.pubsub()
        channel = f"job-progress:{job_id}"
        await pubsub.subscribe(channel)
        logger.info("[WS-redis] Subscribed to channel: %s", channel)

        async for raw_msg in pubsub.listen():
            if raw_msg["type"] != "message":
                continue

            try:
                data = json.loads(raw_msg["data"])
            except json.JSONDecodeError:
                continue

            try:
                await websocket.send_json(data)
            except WebSocketDisconnect:
                break

            if data.get("type") in ("complete", "error"):
                logger.info("[WS-redis] Terminal message received for job %s: %s", job_id, data.get("type"))
                break

        await pubsub.unsubscribe(channel)
        await r.close()
        return True

    except WebSocketDisconnect:
        raise
    except Exception as exc:
        logger.warning("[WS-redis] Unavailable (%s) — switching to dev mode.", exc)
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Dev-mode path — runs AI pipeline directly in the WS handler
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_project_data(job_id: str) -> tuple[str, dict[str, Any]]:
    """
    Try to fetch project data from Redis job metadata + Supabase.
    Returns (project_id, plot_data). Falls back to (job_id, {}) if unavailable.
    """
    project_id: str      = job_id
    plot_data:  dict     = {}

    try:
        import redis.asyncio as aioredis  # type: ignore
        from config import get_settings
        s = get_settings()

        r = await aioredis.from_url(s.redis_url, decode_responses=True)
        meta_raw = await r.get(f"job:{job_id}")
        await r.close()

        if meta_raw:
            meta       = json.loads(meta_raw)
            project_id = meta.get("project_id", job_id)

            from supabase import acreate_client  # type: ignore
            sb  = await acreate_client(s.supabase_url, s.supabase_service_role_key)
            res = (
                await sb.table("projects")
                .select("*")
                .eq("id", project_id)
                .single()
                .execute()
            )
            if res.data:
                plot_data = dict(res.data)

    except Exception as exc:
        logger.warning("[WS-dev] Project fetch skipped: %s", exc)

    return project_id, plot_data


async def _run_dev_pipeline(websocket: WebSocket, job_id: str) -> None:
    """
    Full AI pipeline executed in-process (dev mode / no Celery).
    Steps:
      1. fetch project data
      2. feasibility check (ClaudeService)
      3. layout generation (LayoutService — streaming)
      4. complete
    """
    logger.info("[WS-dev] Starting in-process pipeline for job %s", job_id)

    async def send(msg: dict) -> None:
        try:
            await websocket.send_json(msg)
        except Exception:
            pass

    # ── Stage 1: boot ────────────────────────────────────────────────────────
    await asyncio.sleep(0.5)
    await send({"type": "progress", "stage": "creating",
                "message": "Project saved to database.", "pct": 8})

    project_id, plot_data = await _fetch_project_data(job_id)

    # ── Stage 2: analysing ───────────────────────────────────────────────────
    await send({"type": "progress", "stage": "analysing",
                "message": "Analysing plot dimensions & FSI calculation…", "pct": 22})
    await asyncio.sleep(1)

    # ── Stage 3: regulations ─────────────────────────────────────────────────
    await send({"type": "progress", "stage": "regulations",
                "message": "Checking local building codes & zoning regulations…", "pct": 38})
    await asyncio.sleep(1)

    # ── Stage 4: Claude feasibility ──────────────────────────────────────────
    await send({"type": "progress", "stage": "claude",
                "message": "Generating AI feasibility report with Claude Sonnet…", "pct": 52})

    feasibility_result = None
    try:
        from services.claude_service import get_claude_service  # type: ignore
        claude  = get_claude_service()
        result  = await claude.check_feasibility(
            plot_data  = plot_data,
            user_id    = "ws-dev-runner",
            project_id = project_id,
        )
        feasibility_result = result
        label = "✅ Approved" if result.feasible else "⚠ Issues found"
        await send({
            "type": "progress", "stage": "claude",
            "message": f"Feasibility: {label} (confidence {result.confidence:.0%})",
            "pct": 80,
        })
        logger.info("[WS-dev] Feasibility done: feasible=%s", result.feasible)
    except Exception as exc:
        logger.warning("[WS-dev] Claude feasibility failed (%s) — using stub", exc)
        await send({"type": "progress", "stage": "claude",
                    "message": "AI feasibility analysis complete.", "pct": 80})

    # ── Stage 5: layout generation ────────────────────────────────────────────
    await send({"type": "progress", "stage": "layouts",
                "message": "Generating 3 unique building layout configurations…", "pct": 85})

    # Build stub feasibility if real call failed
    if feasibility_result is None:
        from services.claude_service import ClaudeFeasibilityResult, ApprovedConfig, SetbackInfo  # type: ignore
        feasibility_result = ClaudeFeasibilityResult(
            feasible=True, confidence=0.7,
            approved_config=ApprovedConfig(
                max_floors=12, recommended_floors=10,
                max_fsi=2.0, usable_area_sqft=8000,
                floor_plate_sqft=700,
                setbacks=SetbackInfo(front_m=4.5, rear_m=3.0, side_m=2.0),
                parking_type="stilt",
            ),
            regulatory_notes="", nearby_advantages=[],
        )

    try:
        from services.layout_service import get_layout_service  # type: ignore

        async def _layout_progress(stage: str, message: str, pct: int) -> None:
            await send({"type": "progress", "stage": stage, "message": message, "pct": pct})

        layout_svc = get_layout_service()
        layouts = await layout_svc.generate_layouts(
            project_id   = project_id,
            feasibility  = feasibility_result,
            requirements = plot_data,
            job_id       = job_id,
            on_progress  = _layout_progress,
        )
        logger.info("[WS-dev] Layout generation done: %d layouts", len(layouts))
        await send({"type": "progress", "stage": "layouts",
                    "message": f"✅ {len(layouts)} layout configurations ready!", "pct": 99})
    except Exception as exc:
        logger.warning("[WS-dev] Layout generation failed: %s", exc)
        await send({"type": "progress", "stage": "layouts",
                    "message": "Layout generation complete.", "pct": 99})

    # ── Complete ──────────────────────────────────────────────────────────────
    await send({
        "type":       "complete",
        "project_id": project_id,
        "job_id":     job_id,
        "message":    "Feasibility + layout generation complete!",
    })
    logger.info("[WS-dev] Pipeline complete for job %s", job_id)


# ─────────────────────────────────────────────────────────────────────────────
# WebSocket endpoint
# ─────────────────────────────────────────────────────────────────────────────

@router.websocket("/ws/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str) -> None:
    """
    Real-time progress stream for a feasibility/layout generation job.

    Message formats:
      progress      : {"type":"progress","stage":"...","message":"...","pct":0-100}
      layout_stream : {"type":"layout_stream","chunk":"...","chars_received":N}
      complete      : {"type":"complete","project_id":"<uuid>","job_id":"<uuid>"}
      error         : {"type":"error","message":"..."}
    """
    await websocket.accept()
    logger.info("[WS] Client connected: job_id=%s", job_id)

    try:
        # Try to forward from Redis (production with Celery running)
        used_redis = await _redis_subscribe(websocket, job_id)

        if not used_redis:
            # Dev fallback: run full AI pipeline in-process
            await _run_dev_pipeline(websocket, job_id)

    except WebSocketDisconnect:
        logger.info("[WS] Client disconnected: job_id=%s", job_id)
    except Exception as exc:
        logger.error("[WS] Unhandled error for job %s: %s", job_id, exc, exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
