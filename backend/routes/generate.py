from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from typing import Dict, Any
import uuid
import asyncio
from datetime import datetime

from database import get_db, Project, AgentRun, DesignVariant
from schemas.requests import GenerationStart, GenerationCustomize, VariantSelection
from schemas.responses import (
    GenerationStartResponse, GenerationStatusResponse, GenerationCustomizeResponse,
    VariantSelectionResponse, AgentStatus
)
from agents.orchestrator import ArchitecturalOrchestrator

router = APIRouter()

# Global orchestrator instance
orchestrator = ArchitecturalOrchestrator()


async def run_generation_pipeline(
    project_id: uuid.UUID,
    generation_data: Dict[str, Any],
    db_session: AsyncSession,
    websocket_manager
):
    """Background task to run the complete generation pipeline"""
    try:
        # Update project status
        await db_session.execute(
            update(Project)
            .where(Project.id == project_id)
            .values(status="processing")
        )
        await db_session.commit()
        
        # Send WebSocket update
        await websocket_manager.send_update(str(project_id), {
            "type": "status_update",
            "status": "processing",
            "message": "Starting design generation pipeline"
        })
        
        # Run the orchestrator
        result = await orchestrator.generate_design(
            project_id=str(project_id),
            design_dna=generation_data,
            generation_type="full",
            iterations=1
        )
        
        # Update project with results
        await db_session.execute(
            update(Project)
            .where(Project.id == project_id)
            .values(
                status="complete",
                design_dna=result.get("design_result", {})
            )
        )
        await db_session.commit()
        
        # Send completion update
        await websocket_manager.send_update(str(project_id), {
            "type": "generation_complete",
            "status": "complete",
            "result": result,
            "message": "Design generation completed successfully"
        })
        
    except Exception as e:
        # Update project status to error
        await db_session.execute(
            update(Project)
            .where(Project.id == project_id)
            .values(status="error")
        )
        await db_session.commit()
        
        # Send error update
        await websocket_manager.send_update(str(project_id), {
            "type": "generation_error",
            "status": "error",
            "error": str(e),
            "message": f"Design generation failed: {str(e)}"
        })


@router.post("/start", response_model=GenerationStartResponse)
async def start_generation(
    generation_data: GenerationStart,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Start the complete AI design generation pipeline"""
    try:
        # Verify project exists
        result = await db.execute(
            select(Project).where(Project.id == generation_data.project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if generation is already running
        if project.status == "processing":
            raise HTTPException(status_code=400, detail="Generation already in progress")
        
        # Create design DNA from input
        design_dna = {
            "location": {
                "latitude": generation_data.latitude,
                "longitude": generation_data.longitude
            },
            "plot_area": generation_data.plot_area_sqm,
            "budget": generation_data.budget_inr,
            "floors": generation_data.floors,
            "style_preferences": generation_data.style_preferences,
            "generation_timestamp": datetime.now().isoformat()
        }
        
        # Generate task ID
        task_id = f"gen_{generation_data.project_id}_{int(datetime.now().timestamp())}"
        
        # Start background generation
        from main import app
        websocket_manager = app.state.manager
        
        background_tasks.add_task(
            run_generation_pipeline,
            generation_data.project_id,
            design_dna,
            db,
            websocket_manager
        )
        
        return GenerationStartResponse(
            task_id=task_id,
            project_id=generation_data.project_id,
            status="started",
            message="Design generation pipeline started successfully"
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start generation: {str(e)}")


@router.get("/status/{project_id}", response_model=GenerationStatusResponse)
async def get_generation_status(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get current status of all agents for a project"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Get project and agent runs
        project_result = await db.execute(
            select(Project).where(Project.id == project_uuid)
        )
        project = project_result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get all agent runs for this project
        agent_runs_result = await db.execute(
            select(AgentRun)
            .where(AgentRun.project_id == project_uuid)
            .order_by(AgentRun.created_at.desc())
        )
        agent_runs = agent_runs_result.scalars().all()
        
        # Group by agent name (get latest run for each agent)
        agent_status_map = {}
        for run in agent_runs:
            if run.agent_name not in agent_status_map:
                agent_status_map[run.agent_name] = run
        
        # Create agent status list
        agent_statuses = []
        expected_agents = ["geo", "layout", "design", "threed", "cost", "compliance", "sustainability"]
        
        for agent_name in expected_agents:
            if agent_name in agent_status_map:
                run = agent_status_map[agent_name]
                progress = 100.0 if run.status == "complete" else (50.0 if run.status == "running" else 0.0)
                
                agent_statuses.append(AgentStatus(
                    name=agent_name,
                    status=run.status,
                    progress=progress,
                    output=run.output_data,
                    error=run.error_message,
                    started_at=run.started_at,
                    completed_at=run.completed_at
                ))
            else:
                agent_statuses.append(AgentStatus(
                    name=agent_name,
                    status="pending",
                    progress=0.0
                ))
        
        # Calculate overall progress
        total_progress = sum(agent.progress for agent in agent_statuses) / len(agent_statuses)
        
        return GenerationStatusResponse(
            project_id=project_uuid,
            overall_status=project.status,
            overall_progress=total_progress,
            agents=agent_statuses
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get generation status: {str(e)}")


@router.post("/customize/{project_id}", response_model=GenerationCustomizeResponse)
async def customize_generation(
    project_id: str,
    customize_data: GenerationCustomize,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Re-run specific agents when user modifies inputs"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Verify project exists
        result = await db.execute(
            select(Project).where(Project.id == project_uuid)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Update project with changed inputs
        for field, value in customize_data.changed_inputs.items():
            if hasattr(project, field):
                setattr(project, field, value)
        
        # Update design DNA
        if project.design_dna:
            project.design_dna.update(customize_data.changed_inputs)
        else:
            project.design_dna = customize_data.changed_inputs
        
        await db.commit()
        
        # Create new agent runs for the specified agents
        for agent_name in customize_data.agents_to_rerun:
            agent_run = AgentRun(
                project_id=project_uuid,
                agent_name=agent_name,
                status="pending",
                input_data=customize_data.changed_inputs,
                started_at=datetime.now()
            )
            db.add(agent_run)
        
        await db.commit()
        
        # Generate task ID
        task_id = f"custom_{project_id}_{int(datetime.now().timestamp())}"
        
        # TODO: Start background task to re-run specific agents
        # This would be similar to run_generation_pipeline but only for selected agents
        
        return GenerationCustomizeResponse(
            project_id=project_uuid,
            task_id=task_id,
            status="restarted",
            agents_rerun=customize_data.agents_to_rerun,
            message=f"Restarted {len(customize_data.agents_to_rerun)} agents with updated inputs"
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to customize generation: {str(e)}")


@router.post("/select-variant/{variant_id}", response_model=VariantSelectionResponse)
async def select_variant(
    variant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """User selects their preferred design variant"""
    try:
        variant_uuid = uuid.UUID(variant_id)
        
        # Get the variant
        result = await db.execute(
            select(DesignVariant).where(DesignVariant.id == variant_uuid)
        )
        variant = result.scalar_one_or_none()
        
        if not variant:
            raise HTTPException(status_code=404, detail="Design variant not found")
        
        # Unselect all other variants for this project
        await db.execute(
            update(DesignVariant)
            .where(DesignVariant.project_id == variant.project_id)
            .values(is_selected=False)
        )
        
        # Select this variant
        await db.execute(
            update(DesignVariant)
            .where(DesignVariant.id == variant_uuid)
            .values(is_selected=True)
        )
        
        await db.commit()
        
        return VariantSelectionResponse(
            variant_id=variant_uuid,
            project_id=variant.project_id,
            status="selected",
            message="Design variant selected successfully"
        )
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid variant ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to select variant: {str(e)}")


@router.get("/variants/{project_id}")
async def get_project_variants(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all design variants for a project"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Get all variants for the project
        result = await db.execute(
            select(DesignVariant)
            .where(DesignVariant.project_id == project_uuid)
            .order_by(DesignVariant.score.desc())
        )
        variants = result.scalars().all()
        
        return {
            "project_id": project_id,
            "variants": [
                {
                    "id": str(variant.id),
                    "variant_number": variant.variant_number,
                    "score": variant.score,
                    "is_selected": variant.is_selected,
                    "dna": variant.dna,
                    "model_url": variant.model_url,
                    "thumbnail_url": variant.thumbnail_url,
                    "created_at": variant.created_at.isoformat()
                }
                for variant in variants
            ],
            "total": len(variants)
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get variants: {str(e)}")


@router.delete("/cancel/{project_id}")
async def cancel_generation(
    project_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Cancel ongoing generation for a project"""
    try:
        project_uuid = uuid.UUID(project_id)
        
        # Update project status
        result = await db.execute(
            update(Project)
            .where(Project.id == project_uuid)
            .values(status="cancelled")
        )
        
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Update any running agent runs
        await db.execute(
            update(AgentRun)
            .where(AgentRun.project_id == project_uuid)
            .where(AgentRun.status == "running")
            .values(status="cancelled", completed_at=datetime.now())
        )
        
        await db.commit()
        
        return {
            "project_id": project_id,
            "status": "cancelled",
            "message": "Generation cancelled successfully"
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel generation: {str(e)}")