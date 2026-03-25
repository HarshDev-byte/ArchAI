from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, String, Integer, Float, Boolean, Text, DateTime, ForeignKey, BigInteger
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from sqlalchemy.types import TIMESTAMP
from typing import AsyncGenerator
import uuid
from datetime import datetime

from config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
    echo=True if settings.ENVIRONMENT == "development" else False,
    future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for all models
Base = declarative_base()


class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    name = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")


class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    status = Column(String, default="pending")  # pending|processing|complete|error
    
    # Input data
    latitude = Column(Float)
    longitude = Column(Float)
    plot_area_sqm = Column(Float)
    budget_inr = Column(BigInteger)
    floors = Column(Integer, default=2)
    style_preferences = Column(JSONB, default=list)
    
    # Design DNA
    design_seed = Column(String)
    design_dna = Column(JSONB)
    
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="projects")
    agent_runs = relationship("AgentRun", back_populates="project", cascade="all, delete-orphan")
    design_variants = relationship("DesignVariant", back_populates="project", cascade="all, delete-orphan")
    cost_estimates = relationship("CostEstimate", back_populates="project", cascade="all, delete-orphan")
    geo_analysis = relationship("GeoAnalysis", back_populates="project", cascade="all, delete-orphan")
    compliance_checks = relationship("ComplianceCheck", back_populates="project", cascade="all, delete-orphan")


class AgentRun(Base):
    __tablename__ = "agent_runs"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    agent_name = Column(String, nullable=False)  # geo|cost|layout|design|threed|vr|compliance|sustainability
    status = Column(String, default="pending")  # pending|running|complete|error
    input_data = Column(JSONB)
    output_data = Column(JSONB)
    error_message = Column(Text)
    started_at = Column(TIMESTAMP(timezone=True))
    completed_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="agent_runs")


class DesignVariant(Base):
    __tablename__ = "design_variants"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    variant_number = Column(Integer)
    dna = Column(JSONB)  # The Design DNA for this variant
    score = Column(Float)  # Evolutionary fitness score
    is_selected = Column(Boolean, default=False)
    floor_plan_svg = Column(Text)
    model_url = Column(String)  # URL to .glb file in Supabase Storage
    thumbnail_url = Column(String)
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="design_variants")


class CostEstimate(Base):
    __tablename__ = "cost_estimates"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    breakdown = Column(JSONB)  # Detailed cost breakdown by category
    total_cost_inr = Column(BigInteger)
    cost_per_sqft = Column(Float)
    roi_estimate = Column(JSONB)
    land_value_estimate = Column(BigInteger)
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="cost_estimates")


class GeoAnalysis(Base):
    __tablename__ = "geo_analysis"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    plot_data = Column(JSONB)  # Detected plot boundary
    zoning_type = Column(String)
    fsi_allowed = Column(Float)
    road_access = Column(JSONB)
    nearby_amenities = Column(JSONB)
    elevation_profile = Column(JSONB)
    solar_irradiance = Column(Float)
    wind_data = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="geo_analysis")


class ComplianceCheck(Base):
    __tablename__ = "compliance_checks"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    fsi_used = Column(Float)
    fsi_allowed = Column(Float)
    setback_compliance = Column(JSONB)
    height_compliance = Column(Boolean)
    parking_required = Column(Integer)
    green_area_required = Column(Float)
    issues = Column(JSONB, default=list)
    passed = Column(Boolean)
    created_at = Column(TIMESTAMP(timezone=True), default=func.now())
    
    # Relationships
    project = relationship("Project", back_populates="compliance_checks")


# Dependency to get database session
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Initialize database
async def init_db():
    """Create all database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created successfully")


# Close database connections
async def close_db():
    """Close database engine"""
    await engine.dispose()
    print("✅ Database connections closed")