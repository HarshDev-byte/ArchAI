from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from enum import Enum


class StyleCategory(str, Enum):
    MODERN = "modern"
    TRADITIONAL = "traditional"
    MINIMALIST = "minimalist"
    INDUSTRIAL = "industrial"
    SUSTAINABLE = "sustainable"
    LUXURY = "luxury"


class DesignDNA(BaseModel):
    """Core design DNA that drives architectural generation"""
    
    # Style composition (percentages should sum to 100)
    style_mix: Dict[StyleCategory, float] = Field(
        ..., 
        description="Style percentages that define the design character"
    )
    
    # Functional requirements
    rooms: List[Dict[str, Any]] = Field(
        ...,
        description="Room specifications with sizes and requirements"
    )
    
    # Aesthetic preferences
    color_palette: List[str] = Field(
        default_factory=list,
        description="Preferred color scheme"
    )
    
    material_preferences: List[str] = Field(
        default_factory=list,
        description="Preferred building materials"
    )
    
    # Constraints
    height_limits: Optional[Dict[str, float]] = None
    setback_requirements: Optional[Dict[str, float]] = None
    
    # Sustainability goals
    energy_efficiency_target: Optional[str] = None
    sustainability_features: List[str] = Field(default_factory=list)
    
    # Generation parameters
    seed: Optional[int] = None
    variation_strength: float = Field(default=0.5, ge=0.0, le=1.0)


class GenerationRequest(BaseModel):
    project_id: str
    design_dna: DesignDNA
    generation_type: str = "full"  # full, layout_only, exterior_only
    iterations: int = Field(default=1, ge=1, le=5)


class GenerationResult(BaseModel):
    generation_id: str
    project_id: str
    design_dna: DesignDNA
    floor_plans: List[Dict[str, Any]]
    exterior_views: List[Dict[str, Any]]
    model_files: Dict[str, str]  # format -> file_path
    cost_estimate: Dict[str, Any]
    compliance_check: Dict[str, Any]
    generation_time: float
    created_at: str