from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum


class ProjectStatus(str, Enum):
    DRAFT = "draft"
    GENERATING = "generating"
    COMPLETED = "completed"
    ERROR = "error"


class ProjectType(str, Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    MIXED_USE = "mixed_use"


class ProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    project_type: ProjectType
    location: Dict[str, Any]  # GeoJSON or coordinates
    plot_area: float = Field(..., gt=0)
    budget_range: Optional[Dict[str, float]] = None
    style_preferences: Optional[List[str]] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[ProjectStatus] = None
    design_dna: Optional[Dict[str, Any]] = None
    generated_models: Optional[List[Dict[str, Any]]] = None


class Project(ProjectBase):
    id: str
    user_id: str
    status: ProjectStatus = ProjectStatus.DRAFT
    design_dna: Optional[Dict[str, Any]] = None
    generated_models: Optional[List[Dict[str, Any]]] = None
    cost_estimate: Optional[Dict[str, Any]] = None
    compliance_report: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True