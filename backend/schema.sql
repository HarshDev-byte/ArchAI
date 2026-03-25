-- ArchAI PostgreSQL Database Schema
-- Complete database schema for the AI-powered architectural design platform

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    status TEXT DEFAULT 'pending',  -- pending|processing|complete|error
    
    -- Input data
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    plot_area_sqm DOUBLE PRECISION,
    budget_inr BIGINT,
    floors INTEGER DEFAULT 2,
    style_preferences JSONB DEFAULT '[]',
    
    -- Design DNA
    design_seed TEXT,
    design_dna JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent runs table
CREATE TABLE agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    agent_name TEXT NOT NULL,  -- geo|cost|layout|design|threed|vr|compliance|sustainability
    status TEXT DEFAULT 'pending',  -- pending|running|complete|error
    input_data JSONB,
    output_data JSONB,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Design variants table
CREATE TABLE design_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    variant_number INTEGER,
    dna JSONB,          -- The Design DNA for this variant
    score DOUBLE PRECISION,  -- Evolutionary fitness score
    is_selected BOOLEAN DEFAULT false,
    floor_plan_svg TEXT,
    model_url TEXT,     -- URL to .glb file in Supabase Storage
    thumbnail_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost estimates table
CREATE TABLE cost_estimates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    breakdown JSONB,    -- Detailed cost breakdown by category
    total_cost_inr BIGINT,
    cost_per_sqft DOUBLE PRECISION,
    roi_estimate JSONB,
    land_value_estimate BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Geo analysis table
CREATE TABLE geo_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    plot_data JSONB,    -- Detected plot boundary
    zoning_type TEXT,
    fsi_allowed DOUBLE PRECISION,
    road_access JSONB,
    nearby_amenities JSONB,
    elevation_profile JSONB,
    solar_irradiance DOUBLE PRECISION,
    wind_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compliance checks table
CREATE TABLE compliance_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id),
    fsi_used DOUBLE PRECISION,
    fsi_allowed DOUBLE PRECISION,
    setback_compliance JSONB,
    height_compliance BOOLEAN,
    parking_required INTEGER,
    green_area_required DOUBLE PRECISION,
    issues JSONB DEFAULT '[]',
    passed BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_agent_runs_project_id ON agent_runs(project_id);
CREATE INDEX idx_agent_runs_agent_name ON agent_runs(agent_name);
CREATE INDEX idx_design_variants_project_id ON design_variants(project_id);
CREATE INDEX idx_cost_estimates_project_id ON cost_estimates(project_id);
CREATE INDEX idx_geo_analysis_project_id ON geo_analysis(project_id);
CREATE INDEX idx_compliance_checks_project_id ON compliance_checks(project_id);

-- Create updated_at trigger for projects table
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_projects_updated_at 
    BEFORE UPDATE ON projects 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();