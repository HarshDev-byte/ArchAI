"use client"

import { useEffect } from "react"
import { useParams } from "next/navigation"
import { useProject } from "@/hooks/use-projects"
import { useProjectStore } from "@/store/project"
import { FeasibilityCard } from "@/components/results/FeasibilityCard"
import { LayoutSelector } from "@/components/results/LayoutSelector"
import { ComparisonTable } from "@/components/results/ComparisonTable"
import { PricingCard } from "@/components/results/PricingCard"
import { ExportBar } from "@/components/results/ExportBar"
import { Skeleton } from "@/components/ui/skeleton"

// ── Skeleton Components ──────────────────────────────────────

function FeasibilityCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/3 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5 rounded-full" />
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg bg-white/5 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

function LayoutSelectorSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/6 bg-white/3 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-full" />
            <div className="border-t border-white/10 pt-4">
              <Skeleton className="h-4 w-3/4" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function PricingCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/3 p-6 space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-64 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}

function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0a0b10] pb-20">
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Left Panel - 42% */}
          <div className="lg:col-span-2 space-y-6">
            <FeasibilityCardSkeleton />
            <LayoutSelectorSkeleton />
            <div className="rounded-2xl border border-white/6 bg-white/3 p-6">
              <Skeleton className="h-6 w-40 mb-4" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>

          {/* Right Panel - 58% */}
          <div className="lg:col-span-3 space-y-6">
            <div className="h-64 bg-white/5 rounded-lg flex items-center justify-center">
              <Skeleton className="h-8 w-48" />
            </div>
            <PricingCardSkeleton />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────────────────────

export default function ProjectResultsPage() {
  const params = useParams()
  const projectId = params.id as string
  
  const { data, isLoading, error } = useProject(projectId)
  const { selectLayout, selectedLayout } = useProjectStore()

  // Load project data into store when available
  useEffect(() => {
    if (data?.project && data.feasibility_reports && data.layout_configurations) {
      const project = {
        ...data.project,
        feasibility: data.feasibility_reports[0] || null,
        layouts: data.layout_configurations || []
      }
      
      // Find selected layout or use first one
      const selected = data.layout_configurations.find(l => l.is_selected) || data.layout_configurations[0]
      if (selected) {
        selectLayout(selected)
      }
    }
  }, [data, selectLayout])

  if (isLoading) {
    return <FullPageSkeleton />
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0b10] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Project not found</h1>
          <p className="text-white/60">The project you're looking for doesn't exist or you don't have access to it.</p>
        </div>
      </div>
    )
  }

  const project = data.project
  const feasibilityReport = data.feasibility_reports[0]
  const layouts = data.layout_configurations || []
  const isFeasible = feasibilityReport?.is_feasible || false

  const handleLayoutSelect = (layout: any) => {
    selectLayout(layout)
  }

  return (
    <>
      <div className="min-h-screen bg-[#0a0b10] pb-20">
        <div className="max-w-7xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">{project.name}</h1>
            <p className="text-white/60">
              {project.location_city && project.location_state 
                ? `${project.location_city}, ${project.location_state}` 
                : "Project Results"
              }
              {project.plot_area_sqft && ` • ${Math.round(project.plot_area_sqft).toLocaleString()} sqft`}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Left Panel - 42% */}
            <div className="lg:col-span-2 space-y-6">
              {/* Feasibility Card */}
              {feasibilityReport && (
                <FeasibilityCard
                  feasibility={feasibilityReport}
                  plotArea={project.plot_area_sqft}
                  projectId={projectId}
                />
              )}

              {/* Layout Selector - Only show if feasible */}
              {isFeasible && layouts.length > 0 && (
                <LayoutSelector
                  layouts={layouts}
                  selectedLayoutId={selectedLayout?.id}
                  onLayoutSelect={handleLayoutSelect}
                />
              )}

              {/* Comparison Table - Only show if feasible and has layouts */}
              {isFeasible && layouts.length > 1 && (
                <ComparisonTable layouts={layouts} />
              )}
            </div>

            {/* Right Panel - 58% */}
            <div className="lg:col-span-3 space-y-6">
              {/* 3D Preview Placeholder */}
              <div className="h-64 bg-white/5 rounded-lg flex items-center justify-center text-white/60">
                3D preview loads in P7
              </div>

              {/* Pricing Card - Only show if layout is selected */}
              {selectedLayout && (
                <PricingCard selectedLayout={selectedLayout} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Export Bar */}
      <ExportBar 
        projectId={projectId} 
        selectedLayoutId={selectedLayout?.id}
      />
    </>
  )
}