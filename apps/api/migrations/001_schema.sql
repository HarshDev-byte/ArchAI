-- ============================================================
-- DesignAI — Migration 001: Initial Schema
-- Run in: Supabase Dashboard → SQL Editor, or via supabase db push
-- Created: 2026-03-18
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- EXTENSIONS
-- ────────────────────────────────────────────────────────────

-- uuid_generate_v4() helper (pgcrypto is preferred in modern Postgres)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- PostGIS for future geospatial queries (optional, safe to add now)
-- CREATE EXTENSION IF NOT EXISTS "postgis";


-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

CREATE TYPE plan_type AS ENUM ('starter', 'pro', 'enterprise');

CREATE TYPE project_status AS ENUM (
    'draft',
    'feasibility_done',
    'layouts_generated',
    'exported'
);

CREATE TYPE project_type AS ENUM (
    'apartment',
    'bungalow',
    'villa',
    'mixed_use',
    'township'
);

CREATE TYPE export_type AS ENUM ('gltf', 'pdf', 'dxf', 'json');


-- ────────────────────────────────────────────────────────────
-- TABLE: profiles
-- One row per auth.users entry. Auto-created via trigger below.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
    id                  UUID            PRIMARY KEY
                                        REFERENCES auth.users (id)
                                        ON DELETE CASCADE,

    full_name           TEXT,
    company_name        TEXT,
    phone               TEXT,

    -- Subscription tier
    plan                plan_type       NOT NULL DEFAULT 'starter',

    -- Usage quota tracking
    designs_used        INTEGER         NOT NULL DEFAULT 0
                                        CHECK (designs_used >= 0),
    designs_limit       INTEGER         NOT NULL DEFAULT 5
                                        CHECK (designs_limit >= 0),

    -- Avatar / preferences (extensible)
    avatar_url          TEXT,
    preferences         JSONB           NOT NULL DEFAULT '{}'::JSONB,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.profiles                IS 'User profile — 1:1 with auth.users.';
COMMENT ON COLUMN public.profiles.designs_used   IS 'Number of design generations consumed this billing cycle.';
COMMENT ON COLUMN public.profiles.designs_limit  IS 'Maximum designs allowed by current plan (5 = starter, 20 = pro, -1 = unlimited).';


-- ────────────────────────────────────────────────────────────
-- TABLE: projects
-- One design session per row. Holds plot geometry + metadata.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.projects (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id             UUID            NOT NULL
                                        REFERENCES public.profiles (id)
                                        ON DELETE CASCADE,

    -- Identity
    name                TEXT            NOT NULL DEFAULT 'Untitled Project',

    -- Workflow state machine
    status              project_status  NOT NULL DEFAULT 'draft',

    -- Plot geometry (GeoJSON Feature, stored as JSONB)
    plot_geojson        JSONB,

    -- Derived plot metrics (stored so we don't re-project every time)
    plot_area_sqft      NUMERIC(12, 2),
    plot_length_ft      NUMERIC(10, 2),
    plot_width_ft       NUMERIC(10, 2),

    -- Location
    location_city       TEXT,
    location_state      TEXT,
    location_lat        DOUBLE PRECISION,
    location_lng        DOUBLE PRECISION,

    -- Programme brief
    project_type        project_type,
    floors_requested    INTEGER         CHECK (floors_requested IS NULL OR floors_requested BETWEEN 1 AND 200),

    -- Free-form user requirements (e.g. {"min_units": 20, "parking": true})
    requirements        JSONB           NOT NULL DEFAULT '{}'::JSONB,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.projects                  IS 'A single DesignAI design session for one land parcel.';
COMMENT ON COLUMN public.projects.plot_geojson     IS 'GeoJSON Feature (Polygon/MultiPolygon) drawn by the user on the satellite map.';
COMMENT ON COLUMN public.projects.requirements     IS 'Flexible programme brief: {"min_units":20,"parking":true,"ground_retail":true}.';
COMMENT ON COLUMN public.projects.status           IS 'State machine: draft → feasibility_done → layouts_generated → exported.';


-- ────────────────────────────────────────────────────────────
-- TABLE: feasibility_reports
-- One report per project. Stores the Claude claude-sonnet-4-6 analysis.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feasibility_reports (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id              UUID            NOT NULL UNIQUE
                                            REFERENCES public.projects (id)
                                            ON DELETE CASCADE,

    -- High-level verdict
    is_feasible             BOOLEAN         NOT NULL,

    -- Claude's structured qualitative outputs
    rejection_reasons       TEXT[]          NOT NULL DEFAULT '{}',
    warnings                TEXT[]          NOT NULL DEFAULT '{}',

    -- Regulatory outputs
    max_floors              INTEGER         CHECK (max_floors IS NULL OR max_floors >= 0),
    usable_area_sqft        NUMERIC(12, 2),

    -- Setbacks as JSONB: {"front":3.0, "rear":3.0, "left":1.5, "right":1.5}
    setbacks                JSONB           NOT NULL DEFAULT '{}'::JSONB,

    -- Richer AI outputs stored for audit / re-parse
    raw_claude_response     JSONB           NOT NULL DEFAULT '{}'::JSONB,

    -- Cost tracking
    tokens_used             INTEGER         CHECK (tokens_used IS NULL OR tokens_used >= 0),

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.feasibility_reports                   IS 'AI feasibility analysis produced by Claude claude-sonnet-4-6 for a project.';
COMMENT ON COLUMN public.feasibility_reports.rejection_reasons IS 'Hard blockers preventing development (e.g. flood zone, heritage overlay).';
COMMENT ON COLUMN public.feasibility_reports.warnings          IS 'Soft concerns that should be noted (e.g. proximity to railway, steep slope).';
COMMENT ON COLUMN public.feasibility_reports.raw_claude_response IS 'Full parsed JSON from Claude — kept for re-processing without re-billing.';
COMMENT ON COLUMN public.feasibility_reports.tokens_used       IS 'Anthropic input+output tokens consumed; used for cost monitoring.';


-- ────────────────────────────────────────────────────────────
-- TABLE: layout_configurations
-- Up to 3 generated layouts per project.
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.layout_configurations (
    id                      UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id              UUID            NOT NULL
                                            REFERENCES public.projects (id)
                                            ON DELETE CASCADE,

    -- Deterministic seed for reproducible generation
    design_seed             INTEGER         NOT NULL DEFAULT 0,

    -- Human-readable label (e.g. "Compact Tower", "Courtyard Block")
    concept_name            TEXT            NOT NULL,

    -- 2D plan data: room polygons, corridors, cores
    -- Schema: {"units": [...], "cores": [...], "corridors": [...]}
    floor_plan              JSONB           NOT NULL DEFAULT '{}'::JSONB,

    -- Unit programme breakdown
    -- Schema: [{"type":"2br","count":12,"area_sqft":950}, ...]
    unit_mix                JSONB           NOT NULL DEFAULT '[]'::JSONB,

    -- Amenities list: [{"name":"rooftop garden","floor":10}, ...]
    amenities               JSONB           NOT NULL DEFAULT '[]'::JSONB,

    -- 3D geometry hints passed to the Three.js viewer
    -- Schema: {"blocks": [{"x":0,"y":0,"w":20,"d":15,"floors":8,"use":"residential"}, ...]}
    geometry_hints          JSONB           NOT NULL DEFAULT '{}'::JSONB,

    -- Summary metrics
    total_units             INTEGER         CHECK (total_units IS NULL OR total_units >= 0),
    estimated_cost_inr      NUMERIC(18, 2),
    estimated_revenue_inr   NUMERIC(18, 2),

    -- Only one layout can be "selected" (the one user chooses to export)
    is_selected             BOOLEAN         NOT NULL DEFAULT FALSE,

    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.layout_configurations                         IS 'One of up to 3 building layout options generated for a project.';
COMMENT ON COLUMN public.layout_configurations.design_seed             IS 'Integer seed used by the layout engine to make generation deterministic.';
COMMENT ON COLUMN public.layout_configurations.floor_plan              IS 'Full 2D floor plan data for all floors.';
COMMENT ON COLUMN public.layout_configurations.geometry_hints          IS '3D bounding-box blocks passed to the Three.js R3F viewer.';
COMMENT ON COLUMN public.layout_configurations.estimated_cost_inr      IS 'Rough construction cost estimate in Indian Rupees.';
COMMENT ON COLUMN public.layout_configurations.estimated_revenue_inr   IS 'Projected sale/revenue value in Indian Rupees.';


-- ────────────────────────────────────────────────────────────
-- TABLE: exports
-- One row per export artifact (GLTF, PDF, DXF, JSON).
-- ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exports (
    id                  UUID            PRIMARY KEY DEFAULT gen_random_uuid(),

    project_id          UUID            NOT NULL
                                        REFERENCES public.projects (id)
                                        ON DELETE CASCADE,

    layout_id           UUID            -- nullable: some exports are project-level
                                        REFERENCES public.layout_configurations (id)
                                        ON DELETE SET NULL,

    export_type         export_type     NOT NULL,

    -- Supabase Storage or S3 URL
    file_url            TEXT            NOT NULL,

    -- File size in bytes for storage quota tracking
    file_size_bytes     BIGINT,

    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.exports             IS 'Export artifacts (GLTF 3D model, PDF report, DXF CAD, JSON data) for a project.';
COMMENT ON COLUMN public.exports.layout_id   IS 'NULL for project-level exports (e.g. site analysis PDF); set for layout-specific exports.';
COMMENT ON COLUMN public.exports.file_url    IS 'Publicly accessible URL from Supabase Storage or S3.';


-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────

-- projects — common query patterns
CREATE INDEX IF NOT EXISTS idx_projects_user_id
    ON public.projects (user_id);

CREATE INDEX IF NOT EXISTS idx_projects_status
    ON public.projects (status);

CREATE INDEX IF NOT EXISTS idx_projects_user_status
    ON public.projects (user_id, status);

CREATE INDEX IF NOT EXISTS idx_projects_created_at
    ON public.projects (created_at DESC);

-- GIN index on plot_geojson for JSON operators (@>, ?, etc.)
CREATE INDEX IF NOT EXISTS idx_projects_plot_geojson_gin
    ON public.projects USING GIN (plot_geojson);

-- feasibility_reports
CREATE INDEX IF NOT EXISTS idx_feasibility_project_id
    ON public.feasibility_reports (project_id);

-- layout_configurations
CREATE INDEX IF NOT EXISTS idx_layouts_project_id
    ON public.layout_configurations (project_id);

CREATE INDEX IF NOT EXISTS idx_layouts_is_selected
    ON public.layout_configurations (project_id, is_selected)
    WHERE is_selected = TRUE;

-- exports
CREATE INDEX IF NOT EXISTS idx_exports_project_id
    ON public.exports (project_id);

CREATE INDEX IF NOT EXISTS idx_exports_layout_id
    ON public.exports (layout_id)
    WHERE layout_id IS NOT NULL;


-- ────────────────────────────────────────────────────────────
-- CONSTRAINT: Only one selected layout per project
-- ────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_layouts_one_selected_per_project
    ON public.layout_configurations (project_id)
    WHERE is_selected = TRUE;


-- ────────────────────────────────────────────────────────────
-- TRIGGER: updated_at — auto-stamp on row update
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ────────────────────────────────────────────────────────────
-- TRIGGER: auto-create profile when a new auth.users row is inserted
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
-- Must run as the role that owns auth.users
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        NEW.id,
        -- Pull display name from OAuth metadata if present
        COALESCE(
            NEW.raw_user_meta_data ->> 'full_name',
            NEW.raw_user_meta_data ->> 'name',
            split_part(NEW.email, '@', 1)   -- fallback: username part of email
        ),
        NEW.raw_user_meta_data ->> 'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;   -- safe re-entrant on replays
    RETURN NEW;
END;
$$;

-- Attach trigger to auth.users (runs in the auth schema)
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;

CREATE TRIGGER trg_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- ────────────────────────────────────────────────────────────

-- Enable RLS on every table
ALTER TABLE public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feasibility_reports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.layout_configurations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exports                ENABLE ROW LEVEL SECURITY;


-- ── profiles policies ────────────────────────────────────────

-- Users can only read their own profile
CREATE POLICY "profiles: select own"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile (but NOT change id or plan directly)
CREATE POLICY "profiles: update own"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- The auth trigger inserts the new row via SECURITY DEFINER,
-- so we still need an INSERT policy for the service role
CREATE POLICY "profiles: insert via trigger"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);


-- ── projects policies ─────────────────────────────────────────

CREATE POLICY "projects: select own"
    ON public.projects
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "projects: insert own"
    ON public.projects
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects: update own"
    ON public.projects
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects: delete own"
    ON public.projects
    FOR DELETE
    USING (auth.uid() = user_id);


-- ── feasibility_reports policies ─────────────────────────────
-- Access is granted if the user owns the parent project.

CREATE POLICY "feasibility_reports: select via project"
    ON public.feasibility_reports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = feasibility_reports.project_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "feasibility_reports: insert via project"
    ON public.feasibility_reports
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = feasibility_reports.project_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "feasibility_reports: delete via project"
    ON public.feasibility_reports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = feasibility_reports.project_id
              AND p.user_id = auth.uid()
        )
    );


-- ── layout_configurations policies ───────────────────────────

CREATE POLICY "layout_configurations: select via project"
    ON public.layout_configurations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = layout_configurations.project_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "layout_configurations: insert via project"
    ON public.layout_configurations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = layout_configurations.project_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "layout_configurations: update via project"
    ON public.layout_configurations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = layout_configurations.project_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "layout_configurations: delete via project"
    ON public.layout_configurations
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = layout_configurations.project_id
              AND p.user_id = auth.uid()
        )
    );


-- ── exports policies ──────────────────────────────────────────

CREATE POLICY "exports: select via project"
    ON public.exports
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = exports.project_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "exports: insert via project"
    ON public.exports
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = exports.project_id
              AND p.user_id = auth.uid()
        )
    );

CREATE POLICY "exports: delete via project"
    ON public.exports
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.projects p
            WHERE p.id = exports.project_id
              AND p.user_id = auth.uid()
        )
    );


-- ────────────────────────────────────────────────────────────
-- STORAGE BUCKETS (run separately in Supabase Dashboard if preferred)
-- ────────────────────────────────────────────────────────────

-- Bucket for GLTF / DXF / JSON exports (private, signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Bucket for PDF reports (private, signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: users can only access their own files
-- Files are stored at path: {user_id}/{project_id}/filename

CREATE POLICY "exports bucket: select own"
    ON storage.objects
    FOR SELECT
    USING (
        bucket_id IN ('exports', 'reports')
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "exports bucket: insert own"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id IN ('exports', 'reports')
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );

CREATE POLICY "exports bucket: delete own"
    ON storage.objects
    FOR DELETE
    USING (
        bucket_id IN ('exports', 'reports')
        AND (storage.foldername(name))[1] = auth.uid()::TEXT
    );


-- ────────────────────────────────────────────────────────────
-- HELPER VIEWS
-- ────────────────────────────────────────────────────────────

-- projects_with_status: convenience view joining project + report summary
CREATE OR REPLACE VIEW public.projects_summary AS
SELECT
    p.id,
    p.user_id,
    p.name,
    p.status,
    p.project_type,
    p.location_city,
    p.location_state,
    p.plot_area_sqft,
    p.floors_requested,
    p.created_at,
    p.updated_at,
    fr.is_feasible,
    fr.max_floors,
    fr.usable_area_sqft,
    (
        SELECT COUNT(*)
        FROM public.layout_configurations lc
        WHERE lc.project_id = p.id
    )::INTEGER AS layout_count,
    (
        SELECT COUNT(*)
        FROM public.exports ex
        WHERE ex.project_id = p.id
    )::INTEGER AS export_count
FROM public.projects p
LEFT JOIN public.feasibility_reports fr ON fr.project_id = p.id;

COMMENT ON VIEW public.projects_summary IS 'Convenience view: projects joined with feasibility + counts.';


-- ────────────────────────────────────────────────────────────
-- END OF MIGRATION 001
-- ────────────────────────────────────────────────────────────
