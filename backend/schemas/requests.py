from pydantic import BaseModel, Field, EmailStr
from typing import List, Dict, Any, Optional
from datetime import datetime
import uuid


# Project schemas
class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    plot_area_sqm: Optional[float] = Field(None, gt=0)
    budget_inr: Optional[int] = Field(None, gt=0)
    floors: int = Field(2, ge=1, le=10)
    style_preferences: List[Dict[str, Any]] = Field(default_factory=list)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    plot_area_sqm: Optional[float] = Field(None, gt=0)
    budget_inr: Optional[int] = Field(None, gt=0)
    floors: Optional[int] = Field(None, ge=1, le=10)
    style_preferences: Optional[List[Dict[str, Any]]] = None
    design_dna: Optional[Dict[str, Any]] = None


# Generation schemas
class GenerationStart(BaseModel):
    project_id: uuid.UUID
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    plot_area_sqm: float = Field(..., gt=0)
    budget_inr: int = Field(..., gt=0)
    floors: int = Field(..., ge=1, le=10)
    style_preferences: List[Dict[str, Any]] = Field(..., min_items=1)
    
    class Config:
        json_encoders = {
            uuid.UUID: str
        }


class GenerationCustomize(BaseModel):
    changed_inputs: Dict[str, Any]
    agents_to_rerun: List[str] = Field(..., min_items=1)
    
    class Config:
        schema_extra = {
            "example": {
                "changed_inputs": {
                    "budget_inr": 6000000,
                    "style_preferences": [{"style": "modern", "weight": 0.8}]
                },
                "agents_to_rerun": ["cost", "design", "threed"]
            }
        }


class VariantSelection(BaseModel):
    variant_id: uuid.UUID
    
    class Config:
        json_encoders = {
            uuid.UUID: str
        }


# User schemas
class UserCreate(BaseModel):
    email: EmailStr
    name: str = Field(..., min_length=1, max_length=100)


class UserUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)


# Agent schemas
class AgentRunCreate(BaseModel):
    project_id: uuid.UUID
    agent_name: str = Field(..., pattern="^(geo|cost|layout|design|threed|vr|compliance|sustainability)$")
    input_data: Dict[str, Any]
    
    class Config:
        json_encoders = {
            uuid.UUID: str
        }


class AgentRunUpdate(BaseModel):
    status: str = Field(..., pattern="^(pending|running|complete|error)$")
    output_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None