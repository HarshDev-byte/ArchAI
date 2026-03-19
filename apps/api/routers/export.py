"""
routers/export.py

POST /api/v1/export/pdf   — Generate & upload a PDF report, return signed URL
POST /api/v1/export/gltf  — Generate & upload a GLB model,  return signed URL
POST /api/v1/export/dxf   — Generate & upload a DXF drawing, return signed URL

All three operations are CPU-bound / blocking; they run in a thread-pool
executor via asyncio.to_thread() so they never block the event loop.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from dependencies import get_current_user
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/export", tags=["export"])


# ────────────────────────────────────────────────────────────
# Pydantic I/O models
# ────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    project_id: str
    layout_id:  str | None = None  # required for gltf & dxf; optional for pdf


class ExportResponse(BaseModel):
    project_id:   str
    export_type:  str          # "pdf" | "gltf" | "dxf"
    download_url: str          # Supabase Storage signed URL (24 h)
    expires_in:   int = 86_400 # seconds
    generated_at: str


# ────────────────────────────────────────────────────────────
# Supabase fetch helpers (sync — called inside to_thread)
# ────────────────────────────────────────────────────────────

def _get_supabase():
    from supabase import create_client  # type: ignore
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_role_key)


def _verify_project_access(
    db,
    project_id: str,
    user_id: str,
) -> dict[str, Any]:
    """Return project row or raise ValueError."""
    resp = (
        db.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if not resp.data:
        raise ValueError(f"Project '{project_id}' not found or access denied.")
    return resp.data


def _fetch_selected_layout(
    db,
    project_id: str,
    layout_id: str | None,
) -> dict[str, Any]:
    """
    Return the requested layout (by ID) or the is_selected layout.
    Raises ValueError if nothing found.
    """
    query = db.table("layout_configurations").select("*").eq("project_id", project_id)

    if layout_id:
        query = query.eq("id", layout_id).maybe_single()
        resp = query.execute()
        if not resp.data:
            raise ValueError(f"Layout '{layout_id}' not found for project '{project_id}'.")
        return resp.data

    # Fall back to is_selected
    resp_sel = query.eq("is_selected", True).maybe_single().execute()
    if resp_sel.data:
        return resp_sel.data

    # Fall back to first layout
    resp_any = (
        db.table("layout_configurations")
        .select("*")
        .eq("project_id", project_id)
        .order("design_seed")
        .limit(1)
        .execute()
    )
    if resp_any.data:
        return resp_any.data[0]

    raise ValueError(f"No layouts found for project '{project_id}'.")


def _record_export(
    db,
    project_id: str,
    user_id: str,
    export_type: str,
    signed_url: str,
) -> None:
    """Write an entry to the exports table (non-fatal if it fails)."""
    try:
        now = datetime.now(timezone.utc).isoformat()
        db.table("exports").insert({
            "project_id":  project_id,
            "user_id":     user_id,
            "export_type": export_type,
            "file_url":    signed_url,
            "created_at":  now,
        }).execute()
    except Exception as exc:
        # Exports table might not exist in early envs — never block the response
        logger.warning("Could not record export to DB: %s", exc)


# ────────────────────────────────────────────────────────────
# Common async wrapper
# ────────────────────────────────────────────────────────────

async def _run_export(
    project_id: str,
    layout_id: str | None,
    user_id: str,
    export_type: str,
) -> str:
    """
    Validates access, dispatches the correct service function in a thread,
    records the export, and returns the signed URL.
    Raises HTTPException on any failure.
    """
    # Fetch data inside the thread to keep sync code together
    def _sync_generate() -> str:
        db      = _get_supabase()
        project = _verify_project_access(db, project_id, user_id)

        if export_type == "pdf":
            from services.pdf_service import generate_pdf  # type: ignore
            signed_url = generate_pdf(project_id, user_id)

        elif export_type == "gltf":
            layout = _fetch_selected_layout(db, project_id, layout_id)
            from services.geometry_service import generate_gltf  # type: ignore
            signed_url = generate_gltf(layout, project_id)

        elif export_type == "dxf":
            layout = _fetch_selected_layout(db, project_id, layout_id)
            from services.geometry_service import generate_dxf  # type: ignore
            signed_url = generate_dxf(layout, project, project_id)

        else:
            raise ValueError(f"Unknown export type: {export_type}")

        _record_export(db, project_id, user_id, export_type, signed_url)
        return signed_url

    try:
        signed_url = await asyncio.to_thread(_sync_generate)
        return signed_url
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        logger.error("Export failed [%s]: %s", export_type, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {exc}",
        ) from exc
    except Exception as exc:
        logger.error("Unexpected export error [%s]: %s", export_type, exc, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during export.",
        ) from exc


# ────────────────────────────────────────────────────────────
# POST /api/v1/export/pdf
# ────────────────────────────────────────────────────────────

@router.post(
    "/pdf",
    response_model=ExportResponse,
    summary="Generate a full PDF report for a project",
    description=(
        "Fetches the project, feasibility report, and all layout configurations, "
        "renders an 8-page PDF report using WeasyPrint + Jinja2, uploads it to "
        "Supabase Storage under `reports/{project_id}/report.pdf`, and returns "
        "a signed download URL valid for 24 hours."
    ),
)
async def export_pdf(
    body: ExportRequest,
    user_id: str = Depends(get_current_user),
) -> ExportResponse:
    logger.info("PDF export requested: project=%s user=%s", body.project_id, user_id)

    signed_url = await _run_export(
        project_id=body.project_id,
        layout_id=None,   # PDF covers all layouts
        user_id=user_id,
        export_type="pdf",
    )

    return ExportResponse(
        project_id=body.project_id,
        export_type="pdf",
        download_url=signed_url,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ────────────────────────────────────────────────────────────
# POST /api/v1/export/gltf
# ────────────────────────────────────────────────────────────

@router.post(
    "/gltf",
    response_model=ExportResponse,
    summary="Generate a GLB (glTF binary) 3D model for a layout",
    description=(
        "Reads the selected layout's geometry_hints (or floor_plan.footprint) to "
        "build a procedural 3D building using trimesh. Exports as a GLB file, "
        "uploads to `exports/{project_id}/building.glb`, and returns a signed URL."
    ),
)
async def export_gltf(
    body: ExportRequest,
    user_id: str = Depends(get_current_user),
) -> ExportResponse:
    logger.info("GLTF export requested: project=%s layout=%s user=%s",
                body.project_id, body.layout_id, user_id)

    signed_url = await _run_export(
        project_id=body.project_id,
        layout_id=body.layout_id,
        user_id=user_id,
        export_type="gltf",
    )

    return ExportResponse(
        project_id=body.project_id,
        export_type="gltf",
        download_url=signed_url,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )


# ────────────────────────────────────────────────────────────
# POST /api/v1/export/dxf
# ────────────────────────────────────────────────────────────

@router.post(
    "/dxf",
    response_model=ExportResponse,
    summary="Generate a DXF 2D floor-plan drawing for a layout",
    description=(
        "Builds a dimensioned 2D DXF document using ezdxf: plot boundary, setback "
        "lines (dashed), building footprint, floor annotations, linear dimensions, "
        "and a title block with project name, date, and disclaimer. "
        "Uploads to `exports/{project_id}/building.dxf` and returns a signed URL."
    ),
)
async def export_dxf(
    body: ExportRequest,
    user_id: str = Depends(get_current_user),
) -> ExportResponse:
    logger.info("DXF export requested: project=%s layout=%s user=%s",
                body.project_id, body.layout_id, user_id)

    signed_url = await _run_export(
        project_id=body.project_id,
        layout_id=body.layout_id,
        user_id=user_id,
        export_type="dxf",
    )

    return ExportResponse(
        project_id=body.project_id,
        export_type="dxf",
        download_url=signed_url,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
