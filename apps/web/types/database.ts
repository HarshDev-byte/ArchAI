/**
 * Supabase generated types — hand-crafted to match migration 001_schema.sql
 * Regenerate with: npx supabase gen types typescript --local > types/database.ts
 */

// ─────────────────────────────────────────────────────────────
// Enums (mirror SQL ENUM types)
// ─────────────────────────────────────────────────────────────
export type PlanType = "starter" | "pro" | "enterprise";

export type ProjectStatus =
  | "draft"
  | "feasibility_done"
  | "layouts_generated"
  | "exported";

export type ProjectType =
  | "apartment"
  | "bungalow"
  | "villa"
  | "mixed_use"
  | "township";

export type ExportType = "gltf" | "pdf" | "dxf" | "json";

// ─────────────────────────────────────────────────────────────
// Row shapes (what Supabase returns from SELECT)
// ─────────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  plan: PlanType;
  designs_used: number;
  designs_limit: number;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  status: ProjectStatus;
  plot_geojson: Record<string, unknown> | null;
  plot_area_sqft: number | null;
  plot_length_ft: number | null;
  plot_width_ft: number | null;
  location_city: string | null;
  location_state: string | null;
  location_lat: number | null;
  location_lng: number | null;
  project_type: ProjectType | null;
  floors_requested: number | null;
  requirements: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface FeasibilityReportRow {
  id: string;
  project_id: string;
  is_feasible: boolean;
  rejection_reasons: string[];
  warnings: string[];
  max_floors: number | null;
  usable_area_sqft: number | null;
  setbacks: {
    front: number;
    rear: number;
    left: number;
    right: number;
  };
  raw_claude_response: Record<string, unknown>;
  tokens_used: number | null;
  created_at: string;
}

export interface LayoutConfigurationRow {
  id: string;
  project_id: string;
  design_seed: number;
  concept_name: string;
  floor_plan: Record<string, unknown>;
  unit_mix: Array<{
    type: string;
    count: number;
    area_sqft: number;
  }>;
  amenities: Array<{
    name: string;
    floor?: number;
  }>;
  geometry_hints: {
    blocks?: Array<{
      x: number;
      y: number;
      w: number;
      d: number;
      floors: number;
      use: string;
      hex_color?: string;
    }>;
  };
  total_units: number | null;
  estimated_cost_inr: number | null;
  estimated_revenue_inr: number | null;
  is_selected: boolean;
  created_at: string;
}

export interface ExportRow {
  id: string;
  project_id: string;
  layout_id: string | null;
  export_type: ExportType;
  file_url: string;
  file_size_bytes: number | null;
  created_at: string;
}

// ─────────────────────────────────────────────────────────────
// Insert types (omit auto-generated fields)
// ─────────────────────────────────────────────────────────────

export type ProfileInsert = Pick<ProfileRow, "id"> &
  Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">>;

export type ProjectInsert = Pick<ProjectRow, "user_id"> &
  Partial<Omit<ProjectRow, "id" | "user_id" | "created_at" | "updated_at">>;

export type FeasibilityReportInsert = Pick<
  FeasibilityReportRow,
  "project_id" | "is_feasible"
> &
  Partial<
    Omit<FeasibilityReportRow, "id" | "project_id" | "is_feasible" | "created_at">
  >;

export type LayoutConfigurationInsert = Pick<
  LayoutConfigurationRow,
  "project_id" | "concept_name"
> &
  Partial<
    Omit<
      LayoutConfigurationRow,
      "id" | "project_id" | "concept_name" | "created_at"
    >
  >;

export type ExportInsert = Pick<
  ExportRow,
  "project_id" | "export_type" | "file_url"
> &
  Partial<Omit<ExportRow, "id" | "project_id" | "export_type" | "file_url" | "created_at">>;

// ─────────────────────────────────────────────────────────────
// Update types (all fields optional except PK)
// ─────────────────────────────────────────────────────────────

export type ProfileUpdate = Partial<
  Omit<ProfileRow, "id" | "created_at" | "updated_at">
>;

export type ProjectUpdate = Partial<
  Omit<ProjectRow, "id" | "user_id" | "created_at" | "updated_at">
>;

export type LayoutConfigurationUpdate = Partial<
  Omit<LayoutConfigurationRow, "id" | "project_id" | "created_at">
>;

// ─────────────────────────────────────────────────────────────
// Supabase Database type (passed to createClient<Database>)
// ─────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
      };
      projects: {
        Row: ProjectRow;
        Insert: ProjectInsert;
        Update: ProjectUpdate;
      };
      feasibility_reports: {
        Row: FeasibilityReportRow;
        Insert: FeasibilityReportInsert;
        Update: Partial<Omit<FeasibilityReportRow, "id" | "project_id" | "created_at">>;
      };
      layout_configurations: {
        Row: LayoutConfigurationRow;
        Insert: LayoutConfigurationInsert;
        Update: LayoutConfigurationUpdate;
      };
      exports: {
        Row: ExportRow;
        Insert: ExportInsert;
        Update: Partial<Omit<ExportRow, "id" | "project_id" | "created_at">>;
      };
    };
    Views: {
      projects_summary: {
        Row: ProjectRow & {
          is_feasible: boolean | null;
          max_floors: number | null;
          usable_area_sqft: number | null;
          layout_count: number;
          export_count: number;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      plan_type: PlanType;
      project_status: ProjectStatus;
      project_type: ProjectType;
      export_type: ExportType;
    };
  };
};

// ─────────────────────────────────────────────────────────────
// Additional type aliases for compatibility
// ─────────────────────────────────────────────────────────────

export type Project = ProjectRow;
export type BuildingLayout = LayoutConfigurationRow;
export type FeasibilityResult = FeasibilityReportRow;
export type FeasibilityStatus = "idle" | "pending" | "completed" | "failed" | "success" | "error";

// GeoJSON types for parcel features
export interface ParcelFeature {
  type: "Feature";
  geometry: {
    type: "Polygon";
    coordinates: number[][][];
  };
  properties: {
    area_sqft?: number;
    perimeter_ft?: number;
    [key: string]: any;
  };
}
