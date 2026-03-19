"""
Pydantic models for the DesignAI domain.

Covers the complete data flow:
  PlotInput → FeasibilityResult → LayoutConfig (× 3) → UnitMix
"""
from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


# ──────────────────────────────────────────────────────────────
# GeoJSON primitives (inline — avoids importing geojson package
# just for type hints; still validated at runtime)
# ──────────────────────────────────────────────────────────────

class GeoJSONGeometry(BaseModel):
    """Minimal GeoJSON Geometry object (Polygon or MultiPolygon)."""

    type: str = Field(..., examples=["Polygon"])
    coordinates: list[Any] = Field(
        ...,
        description="Coordinate array. For a Polygon: [[[lng, lat], ...]]",
    )

    @field_validator("type")
    @classmethod
    def validate_geometry_type(cls, v: str) -> str:
        allowed = {"Polygon", "MultiPolygon"}
        if v not in allowed:
            raise ValueError(f"Geometry type must be one of {allowed}, got '{v}'")
        return v


class GeoJSONFeature(BaseModel):
    """Minimal GeoJSON Feature wrapping a Polygon/MultiPolygon geometry."""

    type: str = Field(default="Feature")
    geometry: GeoJSONGeometry
    properties: dict[str, Any] | None = None


# ──────────────────────────────────────────────────────────────
# Input
# ──────────────────────────────────────────────────────────────

class PlotInput(BaseModel):
    """
    The user-drawn land parcel plus optional site context.
    This is the primary input to both feasibility and layout endpoints.
    """

    parcel_geojson: GeoJSONFeature = Field(
        ...,
        description="GeoJSON Feature with a Polygon geometry of the drawn parcel.",
    )
    project_name: str = Field(
        default="Untitled Project",
        max_length=120,
        description="Human-readable name for this design session.",
    )
    location_hint: str | None = Field(
        default=None,
        max_length=256,
        description=(
            "Optional free-text location context (e.g. city, zone) "
            "to help Claude produce more accurate feasibility analysis."
        ),
        examples=["Bandra West, Mumbai, India"],
    )
    extra_constraints: str | None = Field(
        default=None,
        max_length=1024,
        description=(
            "Optional free-text additional constraints or programme brief "
            "(e.g. 'must include 20% affordable housing, ground-floor retail')."
        ),
    )

    class Config:
        json_schema_extra = {
            "example": {
                "parcel_geojson": {
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [
                            [
                                [72.8276, 19.0760],
                                [72.8286, 19.0760],
                                [72.8286, 19.0770],
                                [72.8276, 19.0770],
                                [72.8276, 19.0760],
                            ]
                        ],
                    },
                    "properties": None,
                },
                "project_name": "Marine Drive Tower",
                "location_hint": "South Mumbai, India",
                "extra_constraints": "Mixed-use: retail at ground floor, residential above.",
            }
        }


# ──────────────────────────────────────────────────────────────
# Feasibility
# ──────────────────────────────────────────────────────────────

class SetbackRequirements(BaseModel):
    """Building setback distances required from parcel boundary (metres)."""

    front: float = Field(..., ge=0, description="Front setback in metres.")
    rear: float = Field(..., ge=0, description="Rear setback in metres.")
    left: float = Field(..., ge=0, description="Left / side setback in metres.")
    right: float = Field(..., ge=0, description="Right / side setback in metres.")


class FeasibilityResult(BaseModel):
    """
    AI-generated feasibility analysis for a given parcel.
    Produced by calling Claude claude-sonnet-4-6 with the parcel geometry.
    """

    # Computed parcel metrics
    parcel_area_sqm: float = Field(
        ..., gt=0, description="Total parcel area in square metres."
    )

    # Zoning & regulation outputs from Claude
    score: int = Field(
        ...,
        ge=0,
        le=100,
        description="Overall feasibility score (0 = infeasible, 100 = ideal).",
    )
    zoning_classification: str = Field(
        ...,
        description="Inferred zoning class (e.g. 'R2 – Residential', 'C1 – Commercial').",
    )
    max_floors: int = Field(
        ..., ge=1, description="Maximum permissible number of floors."
    )
    max_far: float = Field(
        ..., gt=0, description="Maximum Floor Area Ratio (FSI/FAR)."
    )
    max_buildable_area_sqm: float = Field(
        ..., gt=0, description="max_far × parcel_area_sqm."
    )
    setbacks: SetbackRequirements
    ground_coverage_pct: float = Field(
        ...,
        ge=0,
        le=100,
        description="Maximum ground coverage as a percentage of parcel area.",
    )

    # Claude's qualitative outputs
    restrictions: list[str] = Field(
        default_factory=list,
        description="List of site restrictions (e.g. heritage overlay, flood zone).",
    )
    opportunities: list[str] = Field(
        default_factory=list,
        description="List of design opportunities (e.g. corner site, north-facing).",
    )
    summary: str = Field(
        ..., description="2–4 sentence plain-English feasibility summary from Claude."
    )
    raw_claude_response: str = Field(
        ..., description="Full unprocessed response from Claude for audit/debug."
    )

    @model_validator(mode="after")
    def compute_max_buildable(self) -> "FeasibilityResult":
        # Recompute to ensure consistency even if caller sets both fields
        self.max_buildable_area_sqm = round(
            self.max_far * self.parcel_area_sqm, 2
        )
        return self


# ──────────────────────────────────────────────────────────────
# Unit Mix
# ──────────────────────────────────────────────────────────────

class UnitType(str, Enum):
    STUDIO = "studio"
    ONE_BED = "1br"
    TWO_BED = "2br"
    THREE_BED = "3br"
    PENTHOUSE = "penthouse"
    RETAIL = "retail"
    OFFICE = "office"
    AMENITY = "amenity"
    PARKING = "parking"


class UnitMix(BaseModel):
    """
    Breakdown of unit types within a single layout configuration.
    Each entry describes one programme element.
    """

    unit_type: UnitType
    count: int = Field(..., ge=0, description="Number of units of this type.")
    area_per_unit_sqm: float = Field(
        ..., gt=0, description="Net internal area per unit in square metres."
    )
    total_area_sqm: float = Field(
        ..., gt=0, description="count × area_per_unit_sqm."
    )
    floor_range: tuple[int, int] | None = Field(
        default=None,
        description="Inclusive floor range this unit type occupies, e.g. (2, 10).",
    )

    @model_validator(mode="after")
    def compute_total(self) -> "UnitMix":
        self.total_area_sqm = round(self.count * self.area_per_unit_sqm, 2)
        return self


# ──────────────────────────────────────────────────────────────
# 3D Building Block (used inside LayoutConfig)
# ──────────────────────────────────────────────────────────────

class BuildingBlockUse(str, Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    PARKING = "parking"
    AMENITY = "amenity"
    CORE = "core"            # lift / stair cores


class BuildingBlock3D(BaseModel):
    """
    Axis-aligned bounding box for a single building volume.
    Coordinates are in local metres from the parcel centroid (x = east, y = north).
    """

    block_id: str = Field(..., description="Unique block identifier within the layout.")
    origin_x: float = Field(..., description="West edge in metres from parcel centroid.")
    origin_y: float = Field(..., description="South edge in metres from parcel centroid.")
    width: float = Field(..., gt=0, description="East-west dimension in metres.")
    depth: float = Field(..., gt=0, description="North-south dimension in metres.")
    floor_height: float = Field(default=3.0, gt=0, description="Height per floor in metres.")
    floors: int = Field(..., ge=1, description="Number of floors in this block.")
    use: BuildingBlockUse = BuildingBlockUse.RESIDENTIAL
    hex_color: str = Field(
        default="#4c6ef5",
        pattern=r"^#[0-9a-fA-F]{6}$",
        description="Display colour for 3D viewer.",
    )

    @property
    def total_height(self) -> float:
        return self.floors * self.floor_height

    @property
    def footprint_area(self) -> float:
        return self.width * self.depth

    @property
    def gross_floor_area(self) -> float:
        return self.footprint_area * self.floors


# ──────────────────────────────────────────────────────────────
# Layout Config
# ──────────────────────────────────────────────────────────────

class LayoutType(str, Enum):
    COMPACT = "compact"       # Single tower / efficient footprint
    COURTYARD = "courtyard"   # Perimeter blocks around central void
    TOWER = "tower"           # Slender high-rise + podium


class LayoutConfig(BaseModel):
    """
    One of three generated building layout configurations.
    Contains full programme data, 3D geometry, and metrics.
    """

    layout_id: str = Field(..., description="UUID for this layout.")
    layout_type: LayoutType
    name: str = Field(..., max_length=80, description="Short human-readable name.")
    description: str = Field(
        ..., max_length=512, description="1–2 sentence layout rationale."
    )

    # Key metrics
    total_floors: int = Field(..., ge=1)
    total_gfa_sqm: float = Field(
        ..., gt=0, description="Total Gross Floor Area across all blocks."
    )
    footprint_area_sqm: float = Field(
        ..., gt=0, description="Total ground-floor building area."
    )
    efficiency_ratio: float = Field(
        ...,
        ge=0,
        le=1,
        description="Net-to-gross ratio — higher means less circulation/structure waste.",
    )
    achieved_far: float = Field(..., gt=0, description="Actual FAR achieved by this layout.")
    open_space_pct: float = Field(
        ...,
        ge=0,
        le=100,
        description="Percentage of parcel left as open/landscaped space.",
    )

    # Programme
    unit_mix: list[UnitMix] = Field(
        default_factory=list,
        description="Full unit/programme breakdown.",
    )

    # 3D geometry
    blocks: list[BuildingBlock3D] = Field(
        default_factory=list,
        description="3D building block volumes for the viewer.",
    )

    # Parcel reference
    parcel_geojson: GeoJSONFeature = Field(
        ..., description="Echo of the original parcel for 3D context."
    )

    class Config:
        json_schema_extra = {
            "example": {
                "layout_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "layout_type": "compact",
                "name": "Compact Tower",
                "description": "Single slender block maximising views and natural light.",
                "total_floors": 12,
                "total_gfa_sqm": 4800.0,
                "footprint_area_sqm": 400.0,
                "efficiency_ratio": 0.82,
                "achieved_far": 2.4,
                "open_space_pct": 42.0,
            }
        }


# ──────────────────────────────────────────────────────────────
# API response wrappers
# ──────────────────────────────────────────────────────────────

class FeasibilityResponse(BaseModel):
    """Full response body for POST /api/v1/feasibility."""

    project_name: str
    feasibility: FeasibilityResult


class LayoutsResponse(BaseModel):
    """Full response body for POST /api/v1/layouts/generate."""

    project_name: str
    layouts: list[LayoutConfig] = Field(
        ...,
        min_length=1,
        max_length=3,
        description="Exactly 3 layout configurations.",
    )
