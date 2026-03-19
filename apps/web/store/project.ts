import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { devtools, persist } from "zustand/middleware";
import type {
  ProjectRow,
  BuildingLayout,
  FeasibilityResult,
  ParcelFeature,
  FeasibilityStatus,
} from "@/types/database";

// ─────────────────────────────────────────────────────────────
// State shape
// ─────────────────────────────────────────────────────────────

interface ProjectState {
  /** The active project being worked on */
  currentProject: (ProjectRow & { 
    parcel?: ParcelFeature;
    feasibility?: FeasibilityResult;
    layouts?: BuildingLayout[];
  }) | null;

  /** The three generated layout options */
  layouts: BuildingLayout[];

  /** Which layout card / 3D model is highlighted */
  selectedLayout: BuildingLayout | null;

  /** True while the AI is running a feasibility check or generating layouts */
  isGenerating: boolean;

  /** Granular status of the feasibility AI call */
  feasibilityStatus: FeasibilityStatus;

  /** Non-null when an error occurs during generation */
  generationError: string | null;
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

interface ProjectActions {
  // ── Project lifecycle ──────────────────────────────────────
  createProject: (name: string) => void;
  loadProject: (project: ProjectRow & { layouts?: BuildingLayout[]; feasibility?: FeasibilityResult }) => void;
  resetProject: () => void;

  // ── Parcel drawing ─────────────────────────────────────────
  setParcel: (parcel: ParcelFeature) => void;
  clearParcel: () => void;

  // ── Feasibility ────────────────────────────────────────────
  setFeasibilityStatus: (status: FeasibilityStatus) => void;
  setFeasibilityResult: (result: FeasibilityResult) => void;

  // ── Layouts ────────────────────────────────────────────────
  setLayouts: (layouts: BuildingLayout[]) => void;
  selectLayout: (layout: BuildingLayout | null) => void;

  // ── Generation UI state ────────────────────────────────────
  setIsGenerating: (value: boolean) => void;
  setGenerationError: (error: string | null) => void;
}

// ─────────────────────────────────────────────────────────────
// Default project factory
// ─────────────────────────────────────────────────────────────

function createDefaultProject(name: string): ProjectRow {
  return {
    id: crypto.randomUUID(),
    user_id: "", // Will be set when creating
    name,
    status: "draft",
    plot_geojson: null,
    plot_area_sqft: null,
    plot_length_ft: null,
    plot_width_ft: null,
    location_city: null,
    location_state: null,
    location_lat: null,
    location_lng: null,
    project_type: null,
    floors_requested: null,
    requirements: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────────────────────────

const initialState: ProjectState = {
  currentProject: null,
  layouts: [],
  selectedLayout: null,
  isGenerating: false,
  feasibilityStatus: "idle",
  generationError: null,
};

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    persist(
      immer((set) => ({
        ...initialState,

        // ── Project lifecycle ────────────────────────────────
        createProject: (name) =>
          set((state) => {
            state.currentProject = createDefaultProject(name);
            state.layouts = [];
            state.selectedLayout = null;
            state.feasibilityStatus = "idle";
            state.generationError = null;
          }),

        loadProject: (project) =>
          set((state) => {
            state.currentProject = project;
            state.layouts = project.layouts || [];
            state.selectedLayout = (project.layouts && project.layouts[0]) || null;
            state.feasibilityStatus = project.feasibility ? "success" : "idle";
          }),

        resetProject: () =>
          set((state) => {
            Object.assign(state, initialState);
          }),

        // ── Parcel drawing ───────────────────────────────────
        setParcel: (parcel) =>
          set((state) => {
            if (!state.currentProject) {
              state.currentProject = createDefaultProject("Untitled Project");
            }
            state.currentProject.parcel = parcel;
            state.currentProject.updated_at = new Date().toISOString();
            // Reset downstream state when parcel changes
            state.layouts = [];
            state.selectedLayout = null;
            state.feasibilityStatus = "idle";
            state.generationError = null;
          }),

        clearParcel: () =>
          set((state) => {
            if (state.currentProject) {
              delete state.currentProject.parcel;
              state.currentProject.updated_at = new Date().toISOString();
            }
            state.layouts = [];
            state.selectedLayout = null;
            state.feasibilityStatus = "idle";
          }),

        // ── Feasibility ─────────────────────────────────────
        setFeasibilityStatus: (status) =>
          set((state) => {
            state.feasibilityStatus = status;
            if (status === "pending") {
              state.isGenerating = true;
              state.generationError = null;
            }
            if (status === "success" || status === "error") {
              state.isGenerating = false;
            }
          }),

        setFeasibilityResult: (result) =>
          set((state) => {
            if (state.currentProject) {
              state.currentProject.feasibility = result;
              state.currentProject.updated_at = new Date().toISOString();
            }
            state.feasibilityStatus = "success";
            state.isGenerating = false;
          }),

        // ── Layouts ─────────────────────────────────────────
        setLayouts: (layouts) =>
          set((state) => {
            state.layouts = layouts;
            state.selectedLayout = layouts[0] ?? null;
            if (state.currentProject) {
              state.currentProject.layouts = layouts;
              state.currentProject.updated_at = new Date().toISOString();
            }
          }),

        selectLayout: (layout) =>
          set((state) => {
            state.selectedLayout = layout;
          }),

        // ── Generation UI state ──────────────────────────────
        setIsGenerating: (value) =>
          set((state) => {
            state.isGenerating = value;
          }),

        setGenerationError: (error) =>
          set((state) => {
            state.generationError = error;
            state.isGenerating = false;
            if (error) state.feasibilityStatus = "error";
          }),
      })),
      {
        name: "designai-project",
        // Only persist the project data — not transient UI flags
        partialize: (state) => ({
          currentProject: state.currentProject,
          layouts: state.layouts,
          selectedLayout: state.selectedLayout,
        }),
      }
    ),
    { name: "DesignAI / ProjectStore" }
  )
);

// ─────────────────────────────────────────────────────────────
// Selector hooks (avoid re-renders on unrelated state changes)
// ─────────────────────────────────────────────────────────────

export const useCurrentProject = () =>
  useProjectStore((s) => s.currentProject);
export const useLayouts = () => useProjectStore((s) => s.layouts);
export const useSelectedLayout = () =>
  useProjectStore((s) => s.selectedLayout);
export const useIsGenerating = () => useProjectStore((s) => s.isGenerating);
export const useFeasibilityStatus = () =>
  useProjectStore((s) => s.feasibilityStatus);
export const useGenerationError = () =>
  useProjectStore((s) => s.generationError);
