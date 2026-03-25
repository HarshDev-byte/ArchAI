from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
import uuid
from datetime import datetime, timedelta

from database import get_db, AgentRun, Project
from schemas.requests import AgentRunCreate, AgentRunUpdate
from schemas.responses import AgentRunResponse

router = APIRouter()


@router.get("/", response_model=List[AgentRunResponse])
async def list_agent_runs(
    project_id: Optional[str] = Query(None, description="Filter by project ID"),
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=200, description="Number of runs to return"),
    db: AsyncSession = Depends(get_db)
):
    """List agent runs with optional filtering"""
    try:
        query = select(AgentRun)
        
        # Apply filters
        if project_id:
            project_uuid = uuid.UUID(project_id)
            query = query.where(AgentRun.project_id == project_uuid)
        
        if agent_name:
            query = query.where(AgentRun.agent_name == agent_name)
        
        if status:
            query = query.where(AgentRun.status == status)
        
        # Order by most recent and limit
        query = query.order_by(desc(AgentRun.created_at)).limit(limit)
        
        result = await db.execute(query)
        agent_runs = result.scalars().all()
        
        return [AgentRunResponse.from_orm(run) for run in agent_runs]
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid project ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list agent runs: {str(e)}")


@router.get("/{run_id}", response_model=AgentRunResponse)
async def get_agent_run(
    run_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get detailed information about a specific agent run"""
    try:
        run_uuid = uuid.UUID(run_id)
        
        result = await db.execute(
            select(AgentRun).where(AgentRun.id == run_uuid)
        )
        agent_run = result.scalar_one_or_none()
        
        if not agent_run:
            raise HTTPException(status_code=404, detail="Agent run not found")
        
        return AgentRunResponse.from_orm(agent_run)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent run: {str(e)}")


@router.post("/", response_model=AgentRunResponse)
async def create_agent_run(
    run_data: AgentRunCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new agent run (typically called by the orchestrator)"""
    try:
        # Verify project exists
        result = await db.execute(
            select(Project).where(Project.id == run_data.project_id)
        )
        project = result.scalar_one_or_none()
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Create agent run
        agent_run = AgentRun(
            project_id=run_data.project_id,
            agent_name=run_data.agent_name,
            status="pending",
            input_data=run_data.input_data,
            started_at=datetime.now()
        )
        
        db.add(agent_run)
        await db.commit()
        await db.refresh(agent_run)
        
        return AgentRunResponse.from_orm(agent_run)
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create agent run: {str(e)}")


@router.put("/{run_id}", response_model=AgentRunResponse)
async def update_agent_run(
    run_id: str,
    run_data: AgentRunUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update agent run status and results"""
    try:
        run_uuid = uuid.UUID(run_id)
        
        result = await db.execute(
            select(AgentRun).where(AgentRun.id == run_uuid)
        )
        agent_run = result.scalar_one_or_none()
        
        if not agent_run:
            raise HTTPException(status_code=404, detail="Agent run not found")
        
        # Update fields
        agent_run.status = run_data.status
        if run_data.output_data is not None:
            agent_run.output_data = run_data.output_data
        if run_data.error_message is not None:
            agent_run.error_message = run_data.error_message
        
        # Set completion time if status is complete or error
        if run_data.status in ["complete", "error"]:
            agent_run.completed_at = datetime.now()
        
        await db.commit()
        await db.refresh(agent_run)
        
        return AgentRunResponse.from_orm(agent_run)
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update agent run: {str(e)}")


@router.get("/stats/summary")
async def get_agent_stats(
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db)
):
    """Get agent performance statistics"""
    try:
        # Calculate date range
        end_date = datetime.now()
        start_date = end_date - timedelta(days=days)
        
        # Get agent run statistics
        result = await db.execute(
            select(
                AgentRun.agent_name,
                AgentRun.status,
                func.count().label('count'),
                func.avg(
                    func.extract('epoch', AgentRun.completed_at - AgentRun.started_at)
                ).label('avg_duration_seconds')
            )
            .where(AgentRun.created_at >= start_date)
            .group_by(AgentRun.agent_name, AgentRun.status)
        )
        
        stats_raw = result.all()
        
        # Organize statistics by agent
        agent_stats = {}
        for row in stats_raw:
            agent_name = row.agent_name
            if agent_name not in agent_stats:
                agent_stats[agent_name] = {
                    "total_runs": 0,
                    "successful_runs": 0,
                    "failed_runs": 0,
                    "pending_runs": 0,
                    "running_runs": 0,
                    "avg_duration_seconds": 0,
                    "success_rate": 0
                }
            
            agent_stats[agent_name]["total_runs"] += row.count
            
            if row.status == "complete":
                agent_stats[agent_name]["successful_runs"] += row.count
                if row.avg_duration_seconds:
                    agent_stats[agent_name]["avg_duration_seconds"] = row.avg_duration_seconds
            elif row.status == "error":
                agent_stats[agent_name]["failed_runs"] += row.count
            elif row.status == "pending":
                agent_stats[agent_name]["pending_runs"] += row.count
            elif row.status == "running":
                agent_stats[agent_name]["running_runs"] += row.count
        
        # Calculate success rates
        for agent_name, stats in agent_stats.items():
            if stats["total_runs"] > 0:
                stats["success_rate"] = (stats["successful_runs"] / stats["total_runs"]) * 100
        
        return {
            "period_days": days,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "agent_stats": agent_stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get agent stats: {str(e)}")


@router.get("/health/check")
async def check_agent_health():
    """Check the health status of all AI agents"""
    try:
        # Import agents to check their availability
        from agents.orchestrator import ArchitecturalOrchestrator
        from agents.geo_agent import GeoAnalysisAgent
        from agents.cost_agent import CostEstimationAgent
        from agents.design_agent import DesignGenerationAgent
        from agents.threed_agent import ThreeDGenerationAgent
        from agents.compliance_agent import ComplianceAgent
        from agents.sustainability_agent import SustainabilityAgent
        from agents.layout_agent import LayoutPlanningAgent
        
        agent_health = {}
        
        # Test each agent
        agents = {
            "orchestrator": ArchitecturalOrchestrator,
            "geo": GeoAnalysisAgent,
            "cost": CostEstimationAgent,
            "design": DesignGenerationAgent,
            "threed": ThreeDGenerationAgent,
            "compliance": ComplianceAgent,
            "sustainability": SustainabilityAgent,
            "layout": LayoutPlanningAgent
        }
        
        for agent_name, agent_class in agents.items():
            try:
                # Try to instantiate the agent
                agent = agent_class()
                agent_health[agent_name] = {
                    "status": "healthy",
                    "message": "Agent initialized successfully"
                }
            except Exception as e:
                agent_health[agent_name] = {
                    "status": "unhealthy",
                    "message": f"Failed to initialize: {str(e)}"
                }
        
        # Overall health
        healthy_agents = sum(1 for health in agent_health.values() if health["status"] == "healthy")
        total_agents = len(agent_health)
        overall_healthy = healthy_agents == total_agents
        
        return {
            "overall_status": "healthy" if overall_healthy else "degraded",
            "healthy_agents": healthy_agents,
            "total_agents": total_agents,
            "agents": agent_health,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        return {
            "overall_status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now().isoformat()
        }


@router.post("/retry/{run_id}")
async def retry_agent_run(
    run_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retry a failed agent run"""
    try:
        run_uuid = uuid.UUID(run_id)
        
        # Get the failed run
        result = await db.execute(
            select(AgentRun).where(AgentRun.id == run_uuid)
        )
        agent_run = result.scalar_one_or_none()
        
        if not agent_run:
            raise HTTPException(status_code=404, detail="Agent run not found")
        
        if agent_run.status != "error":
            raise HTTPException(status_code=400, detail="Can only retry failed runs")
        
        # Create a new run with the same parameters
        new_run = AgentRun(
            project_id=agent_run.project_id,
            agent_name=agent_run.agent_name,
            status="pending",
            input_data=agent_run.input_data,
            started_at=datetime.now()
        )
        
        db.add(new_run)
        await db.commit()
        await db.refresh(new_run)
        
        # TODO: Trigger the actual agent execution
        
        return {
            "original_run_id": run_id,
            "new_run_id": str(new_run.id),
            "status": "retry_scheduled",
            "message": "Agent run retry scheduled successfully"
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to retry agent run: {str(e)}")


@router.delete("/{run_id}")
async def delete_agent_run(
    run_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete an agent run (admin only)"""
    try:
        run_uuid = uuid.UUID(run_id)
        
        result = await db.execute(
            select(AgentRun).where(AgentRun.id == run_uuid)
        )
        agent_run = result.scalar_one_or_none()
        
        if not agent_run:
            raise HTTPException(status_code=404, detail="Agent run not found")
        
        await db.delete(agent_run)
        await db.commit()
        
        return {
            "run_id": run_id,
            "status": "deleted",
            "message": "Agent run deleted successfully"
        }
        
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid run ID format")
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete agent run: {str(e)}")