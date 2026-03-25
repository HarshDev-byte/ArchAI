from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid


# Base response schemas
class BaseResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime
    
    class Config:
        from_attributes = True
        json_encoders = {
            uuid.UUID: str,
            datetime: lambda v: v.isoformat()
        }


# User response schemas
class UserResponse(BaseResponse):
    email: str
    name: Optional[str] = None


# Project response schemas
class ProjectResponse(BaseResponse):
    user_id: uuid.UUID
    name: str
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    plot_area_sqm: Optional[float] = None
    budget_inr: Optional[int] = None
    floors: int
    style_preferences: List[Dict[str, Any]]
    design_seed: Optional[str] = None
    design_dna: Optional[Dict[str, Any]] = None
    updated_at: datetime


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
    page: int
    per_page: int


# Agent run response schemas
class AgentRunResponse(BaseResponse):
    project_id: uuid.UUID
    agent_name: str
    status: str
    input_data: Optional[Dict[str, Any]] = None
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


# Design variant response schemas
class DesignVariantResponse(BaseResponse):
    project_id: uuid.UUID
    variant_number: int
    dna: Optional[Dict[str, Any]] = None
    score: Optional[float] = None
    is_selected: bool
    floor_plan_svg: Optional[str] = None
    model_url: Optional[str] = None
    thumbnail_url: Optional[str] = None


# Cost estimate response schemas
class CostEstimateResponse(BaseResponse):
    project_id: uuid.UUID
    breakdown: Optional[Dict[str, Any]] = None
    total_cost_inr: Optional[int] = None
    cost_per_sqft: Optional[float] = None
    roi_estimate: Optional[Dict[str, Any]] = None
    land_value_estimate: Optional[int] = None


# Geo analysis response schemas
class GeoAnalysisResponse(BaseResponse):
    project_id: uuid.UUID
    plot_data: Optional[Dict[str, Any]] = None
    zoning_type: Optional[str] = None
    fsi_allowed: Optional[float] = None
    road_access: Optional[Dict[str, Any]] = None
    nearby_amenities: Optional[Dict[str, Any]] = None
    elevation_profile: Optional[Dict[str, Any]] = None
    solar_irradiance: Optional[float] = None
    wind_data: Optional[Dict[str, Any]] = None


# Compliance check response schemas
class ComplianceCheckResponse(BaseResponse):
    project_id: uuid.UUID
    fsi_used: Optional[float] = None
    fsi_allowed: Optional[float] = None
    setback_compliance: Optional[Dict[str, Any]] = None
    height_compliance: Optional[bool] = None
    parking_required: Optional[int] = None
    green_area_required: Optional[float] = None
    issues: List[Dict[str, Any]]
    passed: Optional[bool] = None


# Complete project response with all related data
class ProjectDetailResponse(ProjectResponse):
    agent_runs: List[AgentRunResponse]
    design_variants: List[DesignVariantResponse]
    cost_estimates: List[CostEstimateResponse]
    geo_analysis: List[GeoAnalysisResponse]
    compliance_checks: List[ComplianceCheckResponse]


# Generation response schemas
class GenerationStartResponse(BaseModel):
    task_id: str
    project_id: uuid.UUID
    status: str = "started"
    message: str = "Design generation pipeline started"
    
    class Config:
        json_encoders = {
            uuid.UUID: str
        }


class AgentStatus(BaseModel):
    name: str
    status: str
    progress: float = Field(..., ge=0, le=100)
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class GenerationStatusResponse(BaseModel):
    project_id: uuid.UUID
    overall_status: str
    overall_progress: float = Field(..., ge=0, le=100)
    agents: List[AgentStatus]
    
    class Config:
        json_encoders = {
            uuid.UUID: str,
            datetime: lambda v: v.isoformat() if v else None
        }


class GenerationCustomizeResponse(BaseModel):
    project_id: uuid.UUID
    task_id: str
    status: str = "restarted"
    agents_rerun: List[str]
    message: str = "Selected agents restarted with new inputs"
    
    class Config:
        json_encoders = {
            uuid.UUID: str
        }


class VariantSelectionResponse(BaseModel):
    variant_id: uuid.UUID
    project_id: uuid.UUID
    status: str = "selected"
    message: str = "Design variant selected successfully"
    
    class Config:
        json_encoders = {
            uuid.UUID: str
        }


# Error response schemas
class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None
    code: Optional[str] = None


class ValidationErrorResponse(BaseModel):
    error: str = "Validation Error"
    details: List[Dict[str, Any]]