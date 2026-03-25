from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid

from database import get_db, Project, User, AgentRun, DesignVariant, CostEstimate, GeoAnalysis, ComplianceCheck
from schemas.requests import ProjectCreate, ProjectUpdate
from schemas.responses import (
    ProjectResponse, ProjectListResponse, ProjectDetailResponse,
    ErrorResponse
)

router = APIRouter()


@router.post("/", response_model=ProjectResponse)
async def create_project(
    project_data: ProjectCreate,
    user_id: str = Query(..., description="User ID"),
    db: AsyncSession = Depends(get_db)
):
    """Create a new architectural design project"""
    try:
        # Validate user exists
        user_uuid = uuid.UUID(user_id)
        result = await db.execute(select(User).where(User.id == user_uuid))
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Create project
        project = Project(
            user_id=user_uuid,
            name=project_data.name,
            latitude=project_data.latitude,
            longitude=project_data.longitude,
            plot_area_sqm=project_data.plot_area_sqm,
            budget_inr=project_data.budget_inr,
            floors=project_data.floors,
            style_preferences=project_data.style_preferences,
            status="pending"
        )
        
        db.add(project)
        await db.commit()
        await db.refresh(project)
        
        return ProjectResponse.from_orm(project)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create project: {str(e)}")


@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    user_id: str = Query(..., description="User ID"),
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(10, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db)
):
    """List user's projects with pagination and filtering"""
    try:
        user_uuid = uuid.UUID(user_id)
        
        # Build query
        query = select(Project).where(Project.user_id == user_uuid)
        
        if status:
            query = query.where(Project.status == status)
        
        # Get total count
        count_query = select(func.count()).select_from(query.subquery())
        total_result = await db.execute(count_query)
        total = total_result.scalar()
        
        # Apply pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page).order_by(Project.created_at.desc())
        
        result = await db.execute(query)
        projects = result.scalars().all()
        
        return ProjectListResponse(
            projects=[ProjectResponse.from_orm(p) for p in projects],
            total=total,
            page=page,
            per_page=per_page
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list projects: {str(e)}")


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get project with all related data (agent runs, variants, estimates, etc.)"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Load project with all relationships
        query = select(Project).options(
            selectinload(Project.agent_runs),
            selectinload(Project.design_variants),
            selectinload(Project.cost_estimates),
            selectinload(Project.geo_analysis),
            selectinload(Project.compliance_checks)
        ).where(Project.id == project_uuid)
        
        result = await db.execute(query)
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return ProjectDetailResponse.from_orm(project)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project: {str(e)}")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update project details"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Get existing project
        result = await db.execute(select(Project).where(Project.id == project_uuid))
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Update fields
        update_data = project_data.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(project, field, value)
        
        await db.commit()
        await db.refresh(project)
        
        return ProjectResponse.from_orm(project)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update project: {str(e)}")


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete project and all related data"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Get project
        result = await db.execute(select(Project).where(Project.id == project_uuid))
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Delete project (cascade will handle related data)
        await db.delete(project)
        await db.commit()
        
        return {"message": "Project deleted successfully", "project_id": project_id}
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete project: {str(e)}")


@router.get("/{project_id}/status")
async def get_project_status(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get current project status and progress"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Get project with agent runs
        query = select(Project).options(
            selectinload(Project.agent_runs)
        ).where(Project.id == project_uuid)
        
        result = await db.execute(query)
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Calculate progress
        agent_statuses = {}
        for run in project.agent_runs:
            agent_statuses[run.agent_name] = {
                "status": run.status,
                "started_at": run.started_at,
                "completed_at": run.completed_at,
                "error": run.error_message
            }
        
        # Determine overall progress
        total_agents = 8  # geo, cost, layout, design, threed, vr, compliance, sustainability
        completed_agents = len([r for r in project.agent_runs if r.status == "complete"])
        progress = (completed_agents / total_agents) * 100
        
        return {
            "project_id": project_id,
            "status": project.status,
            "progress": progress,
            "agents": agent_statuses,
            "updated_at": project.updated_at
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get project status: {str(e)}")


@router.post("/{project_id}/duplicate", response_model=ProjectResponse)
async def duplicate_project(
    project_id: str,
    new_name: str = Query(..., description="Name for the duplicated project"),
    db: AsyncSession = Depends(get_db)
):
    """Duplicate an existing project with a new name"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Get original project
        result = await db.execute(select(Project).where(Project.id == project_uuid))
        original = result.scalar_one_or_none()
        
        if not original:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create duplicate
        duplicate = Project(
            user_id=original.user_id,
            name=new_name,
            latitude=original.latitude,
            longitude=original.longitude,
            plot_area_sqm=original.plot_area_sqm,
            budget_inr=original.budget_inr,
            floors=original.floors,
            style_preferences=original.style_preferences,
            design_dna=original.design_dna,
            status="pending"
        )
        
        db.add(duplicate)
        await db.commit()
        await db.refresh(duplicate)
        
        return ProjectResponse.from_orm(duplicate)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to duplicate project: {str(e)}")