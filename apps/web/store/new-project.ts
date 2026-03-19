import { create } from "zustand"
import { immer } from "zustand/middleware/immer"
import { devtools } from "zustand/middleware"
import type { Feature, Polygon } from "geojson"
import type { ProjectType } from "@/types/database"

// ─────────────────────────────────────────────────────────────
// Step definitions
// ─────────────────────────────────────────────────────────────

export type WizardStep = 1 | 2 | 3 | 4

export const WIZARD_STEPS: { step: WizardStep; label: string; description: string }[] = [
  { step: 1, label: "Draw Plot",        description: "Outline your land parcel on the map" },
  { step: 2, label: "Project Details",  description: "Name, type, style and floor count" },
  { step: 3, label: "Requirements",     description: "Unit mix, amenities and brief" },
  { step: 4, label: "Review",           description: "Confirm and generate AI report" },
]

// ─────────────────────────────────────────────────────────────
// Step 1 — Plot
// ─────────────────────────────────────────────────────────────

export interface PlotDimensions {
  plotGeoJSON: Feature<Polygon> | null
  plotAreaSqm: number | null
  plotAreaSqft: number | null
  plotAreaCents: number | null   // 1 cent = 40.4686 m² (Indian land unit)
  plotLengthFt: number | null    // Longest edge
  plotWidthFt: number | null     // Shortest edge
  locality: string | null
  locationCity: string | null
  locationState: string | null
  locationLat: number | null
  locationLng: number | null
  isManualEntry: boolean
  /** Human-readable amenity summary from Overpass API — passed to Claude */
  nearbyContext: string | null
}

// ─────────────────────────────────────────────────────────────
// Step 2 — Project details
// ─────────────────────────────────────────────────────────────

export type ProjectStyle = "modern" | "contemporary" | "traditional" | "luxury"
export type BudgetTier = "budget" | "mid_range" | "premium" | "ultra_luxury"
export type TargetBuyer = "end_user" | "investor" | "both"

// ─────────────────────────────────────────────────────────────
// Step 3 — Requirements
// ─────────────────────────────────────────────────────────────

export type BHKType = "studio" | "1bhk" | "2bhk" | "3bhk" | "4bhk_plus"

export interface UnitMixEntry {
  type: BHKType
  enabled: boolean
  count: number
}

// ─────────────────────────────────────────────────────────────
// Full wizard state
// ─────────────────────────────────────────────────────────────

interface NewProjectState {
  currentStep: WizardStep

  // Step 1 — Plot
  plot: PlotDimensions

  // Step 2 — Details
  projectName: string
  projectType: ProjectType | null
  floorsRequested: number
  projectStyle: ProjectStyle | null
  budgetTier: BudgetTier | null
  targetBuyer: TargetBuyer | null

  // Step 3 — Requirements
  unitMix: UnitMixEntry[]
  amenities: string[]   // array of amenity IDs
  specialNotes: string
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

interface NewProjectActions {
  setStep: (step: WizardStep) => void
  nextStep: () => void
  prevStep: () => void

  // Step 1 — Plot
  setPlotFromDraw: (data: Partial<PlotDimensions>) => void
  setPlotManual: (lengthFt: number, widthFt: number) => void
  setIsManualEntry: (value: boolean) => void
  clearPlot: () => void

  // Step 2 — Details
  setProjectName: (name: string) => void
  setProjectType: (type: ProjectType | null) => void
  setFloorsRequested: (floors: number) => void
  setProjectStyle: (style: ProjectStyle | null) => void
  setBudgetTier: (tier: BudgetTier | null) => void
  setTargetBuyer: (buyer: TargetBuyer | null) => void

  // Step 3 — Requirements
  toggleUnitType: (type: BHKType) => void
  setUnitCount: (type: BHKType, count: number) => void
  toggleAmenity: (amenityId: string) => void
  setSpecialNotes: (notes: string) => void

  reset: () => void
}

// ─────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────

const defaultPlot: PlotDimensions = {
  plotGeoJSON: null,
  plotAreaSqm: null,
  plotAreaSqft: null,
  plotAreaCents: null,
  plotLengthFt: null,
  plotWidthFt: null,
  locality: null,
  locationCity: null,
  locationState: null,
  locationLat: null,
  locationLng: null,
  isManualEntry: false,
  nearbyContext: null,
}

export const DEFAULT_UNIT_MIX: UnitMixEntry[] = [
  { type: "studio",    enabled: false, count: 0 },
  { type: "1bhk",      enabled: false, count: 0 },
  { type: "2bhk",      enabled: true,  count: 12 },
  { type: "3bhk",      enabled: true,  count: 8  },
  { type: "4bhk_plus", enabled: false, count: 0 },
]

const initialState: NewProjectState = {
  currentStep: 1,
  plot: defaultPlot,
  projectName: "",
  projectType: null,
  floorsRequested: 12,
  projectStyle: null,
  budgetTier: null,
  targetBuyer: null,
  unitMix: DEFAULT_UNIT_MIX.map((e) => ({ ...e })),
  amenities: [],
  specialNotes: "",
}

// ─────────────────────────────────────────────────────────────
// Store
// ─────────────────────────────────────────────────────────────

export const useNewProjectStore = create<NewProjectState & NewProjectActions>()(
  devtools(
    immer((set) => ({
      ...initialState,

      setStep: (step) => set((s) => { s.currentStep = step }),

      nextStep: () =>
        set((s) => {
          if (s.currentStep < 4) s.currentStep = (s.currentStep + 1) as WizardStep
        }),

      prevStep: () =>
        set((s) => {
          if (s.currentStep > 1) s.currentStep = (s.currentStep - 1) as WizardStep
        }),

      // ── Step 1 ────────────────────────────────────────────
      setPlotFromDraw: (data) =>
        set((s) => {
          Object.assign(s.plot, data)
          s.plot.isManualEntry = false
        }),

      setPlotManual: (lengthFt, widthFt) =>
        set((s) => {
          const sqft = lengthFt * widthFt
          const sqm = sqft * 0.092903
          s.plot.plotLengthFt = lengthFt
          s.plot.plotWidthFt = widthFt
          s.plot.plotAreaSqft = sqft
          s.plot.plotAreaSqm = sqm
          s.plot.plotAreaCents = sqm / 40.4686
          s.plot.plotGeoJSON = null
          s.plot.isManualEntry = true
        }),

      setIsManualEntry: (value) =>
        set((s) => {
          s.plot.isManualEntry = value
          if (!value) {
            s.plot.plotLengthFt = null
            s.plot.plotWidthFt = null
          }
        }),

      clearPlot: () => set((s) => { s.plot = { ...defaultPlot } }),

      // ── Step 2 ────────────────────────────────────────────
      setProjectName: (name) => set((s) => { s.projectName = name }),
      setProjectType: (type) => set((s) => { s.projectType = type }),
      setFloorsRequested: (floors) => set((s) => { s.floorsRequested = floors }),
      setProjectStyle: (style) => set((s) => { s.projectStyle = style }),
      setBudgetTier: (tier) => set((s) => { s.budgetTier = tier }),
      setTargetBuyer: (buyer) => set((s) => { s.targetBuyer = buyer }),

      // ── Step 3 ────────────────────────────────────────────
      toggleUnitType: (type) =>
        set((s) => {
          const entry = s.unitMix.find((u) => u.type === type)
          if (entry) {
            entry.enabled = !entry.enabled
            if (entry.enabled && entry.count === 0) entry.count = 1
          }
        }),

      setUnitCount: (type, count) =>
        set((s) => {
          const entry = s.unitMix.find((u) => u.type === type)
          if (entry) entry.count = Math.max(0, Math.min(count, 999))
        }),

      toggleAmenity: (amenityId) =>
        set((s) => {
          const idx = s.amenities.indexOf(amenityId)
          if (idx === -1) s.amenities.push(amenityId)
          else s.amenities.splice(idx, 1)
        }),

      setSpecialNotes: (notes) =>
        set((s) => { s.specialNotes = notes.slice(0, 300) }),

      reset: () => set(() => ({
        ...initialState,
        unitMix: DEFAULT_UNIT_MIX.map((e) => ({ ...e })),
        amenities: [],
      })),
    })),
    { name: "DesignAI / NewProjectWizard" }
  )
)

// ─────────────────────────────────────────────────────────────
// Selector hooks
// ─────────────────────────────────────────────────────────────

export const useWizardStep  = () => useNewProjectStore((s) => s.currentStep)
export const usePlotData    = () => useNewProjectStore((s) => s.plot)

export const useStep1Valid = () =>
  useNewProjectStore((s) => {
    const { plot } = s
    if (plot.isManualEntry) return !!(plot.plotLengthFt && plot.plotWidthFt)
    return !!plot.plotGeoJSON
  })

export const useStep2Valid = () =>
  useNewProjectStore((s) => s.projectName.trim().length >= 2 && !!s.projectType)

export const useStep3Valid = () => true  // requirements are optional
