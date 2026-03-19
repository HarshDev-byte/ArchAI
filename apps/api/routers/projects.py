"""
Projects router — full CRUD with Supabase JWT auth.

GET  /api/v1/projects/          List current user's projects
POST /api/v1/projects/          Create a new project
GET  /api/v1/projects/{id}      Get single project with related data
PATCH /api/v1/projects/{id}     Update project fields
DELETE /api/v1/projects/{id}    Delete project
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from dependencies import get_current_user
from config import get_settings

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/projects", tags=["projects"])


# ──────────────────────────────────────────────────────────────
# Pydantic I/O models (router-level, lightweight)
# ──────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str = Field(default="Untitled Project", max_length=120)
    project_type: str | None = None
    location_city: str | None = None
    location_state: str | None = None
    location_lat: float | None = None
    location_lng: float | None = None
    floors_requested: int | None = Field(default=None, ge=1, le=200)
    plot_geojson: dict[str, Any] | None = None
    plot_area_sqft: float | None = None
    requirements: dict[str, Any] = Field(default_factory=dict)


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    status: str | None = None
    project_type: str | None = None
    location_city: str | None = None
    location_state: str | None = None
    floors_requested: int | None = None
    plot_geojson: dict[str, Any] | None = None
    plot_area_sqft: float | None = None
    plot_length_ft: float | None = None
    plot_width_ft: float | None = None
    requirements: dict[str, Any] | None = None


class ProjectRecord(BaseModel):
    id: str
    user_id: str
    name: str
    status: str
    project_type: str | None
    location_city: str | None
    location_state: str | None
    location_lat: float | None
    location_lng: float | None
    plot_area_sqft: float | None
    plot_length_ft: float | None
    plot_width_ft: float | None
    floors_requested: int | None
    requirements: dict[str, Any]
    created_at: str
    updated_at: str


class ProjectDetail(ProjectRecord):
    """Extended project with related data nested in."""
    plot_geojson: dict[str, Any] | None
    feasibility_report: dict[str, Any] | None = None
    layout_configurations: list[dict[str, Any]] = []
    exports: list[dict[str, Any]] = []


class ProjectListResponse(BaseModel):
    projects: list[ProjectRecord]
    total: int
    page: int
    page_size: int


# ──────────────────────────────────────────────────────────────
# Supabase client factory
# ──────────────────────────────────────────────────────────────

def _get_supabase():
    """Return an authenticated Supabase service-role client."""
    from supabase import create_client
    settings = get_settings()
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )


# ──────────────────────────────────────────────────────────────
# GET /api/v1/projects/
# ──────────────────────────────────────────────────────────────

@router.get(
    "/",
    response_model=ProjectListResponse,
    summary="List all projects for the authenticated user",
)
async def list_projects(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status_filter: str | None = Query(default=None, alias="status"),
    user_id: str = Depends(get_current_user),
) -> ProjectListResponse:
    supabase = _get_supabase()

    offset = (page - 1) * page_size

    # Build query
    query = (
        supabase.table("projects")
        .select("*", count="exact")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
    )

    if status_filter:
        query = query.eq("status", status_filter)

    response = query.execute()

    if response.data is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch projects.",
        )

    return ProjectListResponse(
        projects=[ProjectRecord(**p) for p in response.data],
        total=response.count or 0,
        page=page,
        page_size=page_size,
    )


# ──────────────────────────────────────────────────────────────
# POST /api/v1/projects/
# ──────────────────────────────────────────────────────────────

@router.post(
    "/",
    response_model=ProjectRecord,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new project",
)
async def create_project(
    payload: ProjectCreate,
    user_id: str = Depends(get_current_user),
) -> ProjectRecord:
    supabase = _get_supabase()

    now = datetime.now(timezone.utc).isoformat()
    insert_data = {
        "user_id": user_id,
        "name": payload.name,
        "status": "draft",
        "project_type": payload.project_type,
        "location_city": payload.location_city,
        "location_state": payload.location_state,
        "location_lat": payload.location_lat,
        "location_lng": payload.location_lng,
        "floors_requested": payload.floors_requested,
        "plot_geojson": payload.plot_geojson,
        "plot_area_sqft": payload.plot_area_sqft,
        "requirements": payload.requirements,
        "created_at": now,
        "updated_at": now,
    }

    response = (
        supabase.table("projects")
        .insert(insert_data)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create project.",
        )

    return ProjectRecord(**response.data[0])


# ──────────────────────────────────────────────────────────────
# GET /api/v1/projects/{project_id}
# ──────────────────────────────────────────────────────────────

@router.get(
    "/{project_id}",
    response_model=ProjectDetail,
    summary="Get a single project with all related data",
)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
) -> ProjectDetail:
    supabase = _get_supabase()

    # Fetch project (RLS enforced via user_id check)
    proj_resp = (
        supabase.table("projects")
        .select("*")
        .eq("id", project_id)
        .eq("user_id", user_id)   # belt-and-suspenders even with RLS
        .single()
        .execute()
    )

    if not proj_resp.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found or you don't have access.",
        )

    project = proj_resp.data

    # Fetch feasibility report
    feasibility = None
    fr_resp = (
        supabase.table("feasibility_reports")
        .select("*")
        .eq("project_id", project_id)
        .maybe_single()
        .execute()
    )
    if fr_resp.data:
        feasibility = fr_resp.data

    # Fetch layout configs
    lc_resp = (
        supabase.table("layout_configurations")
        .select("*")
        .eq("project_id", project_id)
        .order("design_seed")
        .execute()
    )
    layouts = lc_resp.data or []

    # Fetch exports
    ex_resp = (
        supabase.table("exports")
        .select("*")
        .eq("project_id", project_id)
        .order("created_at", desc=True)
        .execute()
    )
    exports = ex_resp.data or []

    return ProjectDetail(
        **project,
        feasibility_report=feasibility,
        layout_configurations=layouts,
        exports=exports,
    )


# ──────────────────────────────────────────────────────────────
# PATCH /api/v1/projects/{project_id}
# ──────────────────────────────────────────────────────────────

@router.patch(
    "/{project_id}",
    response_model=ProjectRecord,
    summary="Update project fields",
)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    user_id: str = Depends(get_current_user),
) -> ProjectRecord:
    supabase = _get_supabase()

    # Only send fields that were actually provided
    update_data = {
        k: v for k, v in payload.model_dump(exclude_unset=True).items()
        if v is not None
    }

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No fields to update.",
        )

    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    response = (
        supabase.table("projects")
        .update(update_data)
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found or you don't have access.",
        )

    return ProjectRecord(**response.data[0])


# ──────────────────────────────────────────────────────────────
# DELETE /api/v1/projects/{project_id}
# ──────────────────────────────────────────────────────────────

@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a project and all related data",
)
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
) -> None:
    supabase = _get_supabase()

    response = (
        supabase.table("projects")
        .delete()
        .eq("id", project_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found or you don't have access.",
        )
