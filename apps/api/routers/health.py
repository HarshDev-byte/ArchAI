"""
Health check router — GET /api/v1/health
"""
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    service: str


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health check",
    description="Returns service status and version. Used by Docker health checks and uptime monitors.",
)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version="1.0.0",
        service="designai-api",
    )
