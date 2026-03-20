"use client"

import { useState, useEffect } from "react"
import { useNewProjectStore, type ProjectStyle, type BudgetTier } from "@/store/new-project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import { cn } from "@/lib/utils"
import { 
  Building, 
  Home, 
  Castle, 
  Building2, 
  MapPin,
  Palette,
  DollarSign,
  Layers3
} from "lucide-react"
import type { ProjectType } from "@/types/database"

// ─────────────────────────────────────────────────────────────
// Project Type Cards
// ─────────────────────────────────────────────────────────────

const PROJECT_TYPES: Array<{
  type: ProjectType
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}> = [
  {
    type: "apartment",
    label: "Apartment",
    description: "Multi-story residential complex",
    icon: Building,
  },
  {
    type: "bungalow", 
    label: "Bungalow",
    description: "Single-story independent house",
    icon: Home,
  },
  {
    type: "villa",
    label: "Villa", 
    description: "Luxury independent house",
    icon: Castle,
  },
  {
    type: "mixed_use",
    label: "Mixed Use",
    description: "Commercial + residential",
    icon: Building2,
  },
  {
    type: "township",
    label: "Township",
    description: "Large integrated development",
    icon: MapPin,
  },
]

function ProjectTypeSelector() {
  const { projectType, setProjectType } = useNewProjectStore()

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-white/70">Project Type</label>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {PROJECT_TYPES.map(({ type, label, description, icon: Icon }) => (
          <button
            key={type}
            onClick={() => setProjectType(type)}
            className={cn(
              "p-4 rounded-xl border-2 transition-all duration-200 text-left",
              "hover:border-[#7F77DD]/50 hover:bg-[#7F77DD]/5",
              projectType === type
                ? "border-[#7F77DD] bg-[#7F77DD]/10"
                : "border-white/10 bg-white/2"
            )}
          >
            <Icon 
              size={24} 
              className={cn(
                "mb-2",
                projectType === type ? "text-[#7F77DD]" : "text-white/40"
              )} 
            />
            <h3 className={cn(
              "font-semibold text-sm mb-1",
              projectType === type ? "text-white" : "text-white/70"
            )}>
              {label}
            </h3>
            <p className="text-xs text-white/40 leading-relaxed">
              {description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Style Selector
// ─────────────────────────────────────────────────────────────

const STYLES: Array<{
  style: ProjectStyle
  label: string
  description: string
}> = [
  { style: "modern", label: "Modern", description: "Clean lines, minimalist" },
  { style: "contemporary", label: "Contemporary", description: "Current trends, mixed materials" },
  { style: "traditional", label: "Traditional", description: "Classic Indian architecture" },
  { style: "luxury", label: "Luxury", description: "Premium finishes, grand design" },
]

function StyleSelector() {
  const { projectStyle, setProjectStyle } = useNewProjectStore()

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-white/70 flex items-center gap-2">
        <Palette size={16} />
        Architectural Style
      </label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STYLES.map(({ style, label, description }) => (
          <button
            key={style}
            onClick={() => setProjectStyle(style)}
            className={cn(
              "p-3 rounded-lg border transition-all duration-200 text-left",
              "hover:border-[#7F77DD]/50 hover:bg-[#7F77DD]/5",
              projectStyle === style
                ? "border-[#7F77DD] bg-[#7F77DD]/10"
                : "border-white/10 bg-white/2"
            )}
          >
            <h3 className={cn(
              "font-medium text-sm mb-1",
              projectStyle === style ? "text-white" : "text-white/70"
            )}>
              {label}
            </h3>
            <p className="text-xs text-white/40">
              {description}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Budget Tier Selector
// ─────────────────────────────────────────────────────────────

const BUDGET_TIERS: Array<{
  tier: BudgetTier
  label: string
  description: string
  range: string
}> = [
  { tier: "budget", label: "Budget", description: "Cost-effective solutions", range: "₹1,200-1,800/sqft" },
  { tier: "mid_range", label: "Mid-range", description: "Good quality finishes", range: "₹1,800-2,800/sqft" },
  { tier: "premium", label: "Premium", description: "High-end materials", range: "₹2,800-4,500/sqft" },
  { tier: "ultra_luxury", label: "Ultra Luxury", description: "Finest finishes", range: "₹4,500+/sqft" },
]

function BudgetSelector() {
  const { budgetTier, setBudgetTier } = useNewProjectStore()

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-white/70 flex items-center gap-2">
        <DollarSign size={16} />
        Budget Tier
      </label>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {BUDGET_TIERS.map(({ tier, label, description, range }) => (
          <button
            key={tier}
            onClick={() => setBudgetTier(tier)}
            className={cn(
              "p-3 rounded-lg border transition-all duration-200 text-left",
              "hover:border-[#7F77DD]/50 hover:bg-[#7F77DD]/5",
              budgetTier === tier
                ? "border-[#7F77DD] bg-[#7F77DD]/10"
                : "border-white/10 bg-white/2"
            )}
          >
            <h3 className={cn(
              "font-medium text-sm mb-1",
              budgetTier === tier ? "text-white" : "text-white/70"
            )}>
              {label}
            </h3>
            <p className="text-xs text-white/40 mb-1">
              {description}
            </p>
            <p className="text-xs text-[#7F77DD] font-medium">
              {range}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Floors Slider
// ─────────────────────────────────────────────────────────────

function FloorsSlider() {
  const { floorsRequested, setFloorsRequested } = useNewProjectStore()

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-white/70 flex items-center gap-2">
        <Layers3 size={16} />
        Number of Floors: {floorsRequested}
      </label>
      <div className="space-y-2">
        <input
          type="range"
          min={1}
          max={40}
          value={floorsRequested}
          onChange={(e) => setFloorsRequested(Number(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
          style={{
            background: `linear-gradient(to right, #7F77DD 0%, #7F77DD ${((floorsRequested - 1) / 39) * 100}%, rgba(255,255,255,0.1) ${((floorsRequested - 1) / 39) * 100}%, rgba(255,255,255,0.1) 100%)`
          }}
        />
        <div className="flex justify-between text-xs text-white/40">
          <span>1 floor</span>
          <span>40 floors</span>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function ProjectDetailsStep() {
  const { 
    projectName, 
    setProjectName, 
    plot,
    projectType 
  } = useNewProjectStore()

  // Auto-suggest project name
  useEffect(() => {
    if (!projectName && plot.locality && projectType) {
      const year = new Date().getFullYear()
      const typeLabel = PROJECT_TYPES.find(t => t.type === projectType)?.label || "Project"
      const suggestedName = `${plot.locality} ${typeLabel} ${year}`
      setProjectName(suggestedName)
    }
  }, [plot.locality, projectType, projectName, setProjectName])

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Project Details</h2>
        <p className="text-white/60">
          Tell us about your project vision and requirements
        </p>
      </div>

      {/* Project Name */}
      <FormField label="Project Name" htmlFor="project-name">
        <Input
          id="project-name"
          type="text"
          placeholder="Enter project name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="text-lg"
        />
      </FormField>

      {/* Project Type */}
      <ProjectTypeSelector />

      {/* Floors */}
      <FloorsSlider />

      {/* Style */}
      <StyleSelector />

      {/* Budget */}
      <BudgetSelector />
    </div>
  )
}