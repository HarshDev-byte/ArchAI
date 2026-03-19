"""
workers/tasks.py

Celery task definitions for DesignAI's async AI pipeline.

Task 1: run_feasibility_check(project_id, user_id)
  fetch project → claude_service.check_feasibility() → save feasibility_reports
  → publish {type:"complete"} → update project status = "feasibility_done"

Task 2: run_layout_generation(project_id, user_id)
  fetch project + feasibility → layout_service.generate_layouts()
  → save layouts → publish complete → update project status = "layouts_generated"

Both tasks publish rich progress events to Redis channel job:{job_id} so the
WebSocket router can forward them live to the browser.

Celery app is configured in workers/celery_app.py (imported below).
"""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Celery app
# ─────────────────────────────────────────────────────────────────────────────

def _get_celery():
    """Lazy import so the module can be imported even without Celery installed."""
    try:
        from celery import Celery  # type: ignore
        from config import get_settings
        s = get_settings()
        app = Celery(
            "designai",
            broker=s.redis_url,
            backend=s.redis_url,
        )
        app.conf.update(
            task_serializer="json",
            result_serializer="json",
            accept_content=["json"],
            timezone="UTC",
            enable_utc=True,
            task_track_started=True,
            task_acks_late=True,
            worker_prefetch_multiplier=1,  # One task at a time (AI tasks are heavy)
        )
        return app
    except ImportError:
        return None


# Module-level singleton
try:
    celery_app = _get_celery()
except Exception:
    celery_app = None


# ─────────────────────────────────────────────────────────────────────────────
# Helpers: Supabase sync client (Celery tasks run in sync context)
# ─────────────────────────────────────────────────────────────────────────────

def _supabase():
    from supabase import create_client  # type: ignore
    from config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def _redis_sync():
    import redis  # type: ignore
    from config import get_settings
    return redis.from_url(get_settings().redis_url, decode_responses=True)


def _publish(r, job_id: str, msg: dict) -> None:
    """Publish a message to the job's Redis pub/sub channel."""
    try:
        r.publish(f"job-progress:{job_id}", json.dumps(msg))
    except Exception as exc:
        logger.warning("[task] Redis publish error: %s", exc)


def _update_project_status(db, project_id: str, new_status: str) -> None:
    db.table("projects").update({
        "status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", project_id).execute()


def _run_async(coro):
    """Run an async coroutine from a synchronous Celery task."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            raise RuntimeError
        return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


# ─────────────────────────────────────────────────────────────────────────────
# Task decorators (conditional on Celery being available)
# ─────────────────────────────────────────────────────────────────────────────

def _task(*args, **kwargs):
    """Decorator that applies @celery_app.task if Celery is available, else is a no-op."""
    def decorator(fn):
        if celery_app is not None:
            return celery_app.task(*args, **kwargs)(fn)
        # Stub: make the function callable with .delay() even without Celery
        fn.delay = lambda *a, **kw: None
        fn.apply_async = lambda *a, **kw: None
        return fn
    return decorator


# ─────────────────────────────────────────────────────────────────────────────
# Task 1 — Feasibility check
# ─────────────────────────────────────────────────────────────────────────────

@_task(name="tasks.run_feasibility_check", bind=True, max_retries=2, default_retry_delay=10)
def run_feasibility_check(self, job_id: str, project_id: str, user_id: str) -> dict:
    """
    Celery task:
      1. Fetch project from Supabase
      2. Call claude_service.check_feasibility()
      3. Save result to feasibility_reports table
      4. Publish {type:"complete"} to Redis
      5. Update project status → "feasibility_done"
    """
    db = _supabase()
    r  = _redis_sync()

    logger.info("[task:feasibility] START job=%s project=%s", job_id, project_id)

    try:
        # ── 1. Fetch project ─────────────────────────────────────────────────
        _publish(r, job_id, {
            "type": "progress", "stage": "analysing",
            "message": "Fetching project data…", "pct": 10,
        })

        proj_resp = db.table("projects").select("*").eq("id", project_id).single().execute()
        if not proj_resp.data:
            raise ValueError(f"Project {project_id} not found")
        plot_data: dict[str, Any] = proj_resp.data

        # ── 2. Regulations check ──────────────────────────────────────────────
        _publish(r, job_id, {
            "type": "progress", "stage": "regulations",
            "message": "Checking local building codes & zoning regulations", "pct": 30,
        })

        # ── 3. Claude feasibility call ────────────────────────────────────────
        _publish(r, job_id, {
            "type": "progress", "stage": "claude",
            "message": "Generating AI feasibility report with Claude Sonnet…", "pct": 50,
        })

        from services.claude_service import get_claude_service  # type: ignore
        claude = get_claude_service()

        result = _run_async(claude.check_feasibility(
            plot_data  = plot_data,
            user_id    = user_id,
            project_id = project_id,
        ))

        _publish(r, job_id, {
            "type": "progress", "stage": "claude",
            "message": (
                f"Feasibility: {'✅ Approved' if result.feasible else '⚠ Issues found'} "
                f"(confidence {result.confidence:.0%})"
            ),
            "pct": 85,
        })

        # ── 4. Update project status ──────────────────────────────────────────
        _update_project_status(db, project_id, "feasibility_done")

        # ── 5. Publish complete ───────────────────────────────────────────────
        complete_payload = {
            "type":       "complete",
            "project_id": project_id,
            "job_id":     job_id,
            "feasible":   result.feasible,
            "confidence": result.confidence,
            "rejection_reasons": result.rejection_reasons,
            "warnings":          result.warnings,
        }
        _publish(r, job_id, complete_payload)

        logger.info(
            "[task:feasibility] DONE job=%s feasible=%s", job_id, result.feasible
        )
        return complete_payload

    except Exception as exc:
        logger.error("[task:feasibility] ERROR job=%s: %s", job_id, exc, exc_info=True)
        _publish(r, job_id, {
            "type":    "error",
            "message": str(exc),
            "job_id":  job_id,
        })
        raise self.retry(exc=exc) if celery_app else exc
    finally:
        try:
            r.close()
        except Exception:
            pass


# ─────────────────────────────────────────────────────────────────────────────
# Task 2 — Layout generation
# ─────────────────────────────────────────────────────────────────────────────

@_task(name="tasks.run_layout_generation", bind=True, max_retries=1, default_retry_delay=30)
def run_layout_generation(self, job_id: str, project_id: str, user_id: str) -> dict:
    """
    Celery task:
      1. Fetch project + last feasibility_report
      2. Reconstruct ClaudeFeasibilityResult from DB data
      3. Call layout_service.generate_layouts() with on_progress → Redis publish
      4. Layouts are saved to DB inside generate_layouts()
      5. Publish {type:"complete"} to Redis
      6. Update project status → "layouts_generated"
    """
    db = _supabase()
    r  = _redis_sync()

    logger.info("[task:layouts] START job=%s project=%s", job_id, project_id)

    try:
        # ── 1. Fetch project ─────────────────────────────────────────────────
        _publish(r, job_id, {
            "type": "progress", "stage": "layouts",
            "message": "Fetching project & feasibility data…", "pct": 82,
        })

        proj_resp = db.table("projects").select("*").eq("id", project_id).single().execute()
        if not proj_resp.data:
            raise ValueError(f"Project {project_id} not found")
        plot_data: dict[str, Any] = proj_resp.data

        # ── 2. Fetch feasibility report ───────────────────────────────────────
        fr_resp = (
            db.table("feasibility_reports")
            .select("*")
            .eq("project_id", project_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not fr_resp.data:
            raise ValueError(f"No feasibility report found for project {project_id}. Run feasibility check first.")

        fr = fr_resp.data[0]
        if not fr.get("is_feasible"):
            raise ValueError("Project is not feasible. Cannot generate layouts.")

        # ── 3. Reconstruct ClaudeFeasibilityResult from raw DB record ─────────
        from services.claude_service import ClaudeFeasibilityResult, ApprovedConfig, SetbackInfo  # type: ignore

        raw_resp  = fr.get("raw_claude_response") or {}
        approved  = raw_resp.get("approved_config") or {}
        setbacks  = approved.get("setbacks") or {}

        feasibility = ClaudeFeasibilityResult(
            feasible           = fr["is_feasible"],
            confidence         = raw_resp.get("confidence", 0.8),
            rejection_reasons  = fr.get("rejection_reasons") or [],
            warnings           = fr.get("warnings") or [],
            regulatory_notes   = raw_resp.get("regulatory_notes", ""),
            nearby_advantages  = raw_resp.get("nearby_advantages", []),
            approved_config    = ApprovedConfig(
                max_floors          = fr.get("max_floors") or approved.get("max_floors", 10),
                recommended_floors  = approved.get("recommended_floors", 8),
                max_fsi             = approved.get("max_fsi", 2.0),
                usable_area_sqft    = fr.get("usable_area_sqft") or approved.get("usable_area_sqft", 5000),
                floor_plate_sqft    = approved.get("floor_plate_sqft", 600),
                setbacks            = SetbackInfo(
                    front_m = setbacks.get("front_m", 4.5),
                    rear_m  = setbacks.get("rear_m", 3.0),
                    side_m  = setbacks.get("side_m", 2.0),
                ),
                parking_type = approved.get("parking_type", "stilt"),
            ) if fr.get("is_feasible") else None,
        )

        # ── 4. async progress callback → Redis pub ────────────────────────────
        async def on_progress(stage: str, message: str, pct: int) -> None:
            _publish(r, job_id, {
                "type": "progress", "stage": stage,
                "message": message, "pct": pct,
            })

        _publish(r, job_id, {
            "type": "progress", "stage": "layouts",
            "message": "Generating 3 unique layout configurations with Claude…", "pct": 87,
        })

        # ── 5. Generate layouts (streaming, saves to DB internally) ───────────
        from services.layout_service import get_layout_service  # type: ignore
        layout_svc = get_layout_service()

        layouts = _run_async(layout_svc.generate_layouts(
            project_id   = project_id,
            feasibility  = feasibility,
            requirements = plot_data,
            job_id       = job_id,
            on_progress  = on_progress,
        ))

        # ── 6. Update project status ──────────────────────────────────────────
        _update_project_status(db, project_id, "layouts_generated")

        # ── 7. Publish complete ───────────────────────────────────────────────
        complete_payload = {
            "type":       "complete",
            "project_id": project_id,
            "job_id":     job_id,
            "layouts":    [
                {
                    "layout_id":    l.layout_id,
                    "concept_name": l.concept_name,
                    "floors":       l.floors,
                    "total_units":  l.total_units,
                    "roi_pct":      l.roi_pct,
                    "seed":         l.seed,
                }
                for l in layouts
            ],
        }
        _publish(r, job_id, complete_payload)

        logger.info(
            "[task:layouts] DONE job=%s layouts=%d", job_id, len(layouts)
        )
        return complete_payload

    except Exception as exc:
        logger.error("[task:layouts] ERROR job=%s: %s", job_id, exc, exc_info=True)
        _publish(r, job_id, {
            "type":    "error",
            "message": str(exc),
            "job_id":  job_id,
        })
        raise self.retry(exc=exc) if celery_app else exc
    finally:
        try:
            r.close()
        except Exception:
            pass


# Celery CLI / tooling expects a top-level app variable (e.g. `celery -A workers.tasks`)
# Some tools also look for `celery`.
app = celery_app
celery = celery_app
