"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, MapPin, Calendar, ChevronRight, Layers, Trash2, Eye } from "lucide-react"
import { useDeleteProject } from "@/hooks/use-projects"
import { cn } from "@/lib/utils"
import type { ProjectWithCounts } from "@/hooks/use-projects"

// ── Status display map ────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; variant: "secondary" | "default" | "destructive" | "outline"; color: string }
> = {
  draft:               { label: "Draft",            variant: "outline",    color: "text-white/60" },
  feasibility_done:    { label: "Feasibility Done", variant: "secondary",  color: "text-yellow-400" },
  layouts_generated:   { label: "Layouts Generated", variant: "default",   color: "text-blue-400" },
  exported:            { label: "Exported",          variant: "destructive", color: "text-green-400" },
}

const TYPE_LABELS: Record<string, string> = {
  apartment:  "Apartment Complex",
  bungalow:   "Bungalow",
  villa:      "Villa",
  mixed_use:  "Mixed Use Development",
  township:   "Township",
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    const date = new Date(iso)
    return date.toLocaleDateString("en-GB", { 
      day: "numeric", 
      month: "short", 
      year: "numeric" 
    })
  } catch {
    return "—"
  }
}

// ────────────────────────────────────────────────────────────
// ProjectCard
// ────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectWithCounts
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteProject = useDeleteProject()

  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft
  const typeLabel = project.project_type
    ? TYPE_LABELS[project.project_type]
    : null

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isDeleting) return
    
    const confirmed = window.confirm(
      `Are you sure you want to delete "${project.name}"? This action cannot be undone.`
    )
    
    if (!confirmed) return
    
    setIsDeleting(true)
    try {
      await deleteProject.mutateAsync(project.id)
    } catch (error) {
      console.error("Failed to delete project:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewResults = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    router.push(`/dashboard/projects/${project.id}/results`)
  }

  const handleCardClick = () => {
    // If project has layouts, go to results, otherwise go to wizard
    if (project.layout_count > 0) {
      router.push(`/dashboard/projects/${project.id}/results`)
    } else {
      router.push(`/dashboard/projects/new?project=${project.id}`)
    }
  }

  return (
    <div
      className={cn(
        "group relative flex flex-col rounded-2xl border border-white/7 bg-white/3 p-5 transition-all duration-200 cursor-pointer",
        "hover:bg-white/5 hover:border-[#7F77DD]/25 hover:shadow-lg hover:shadow-[#7F77DD]/5"
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Status badge */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <Badge variant={status.variant} className={status.color}>
          {status.label}
        </Badge>
        <ChevronRight
          size={15}
          className="text-white/20 group-hover:text-[#7F77DD] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5"
        />
      </div>

      {/* Project name */}
      <h3 className="font-medium text-white leading-tight mb-1 line-clamp-2 group-hover:text-[#9990e8] transition-colors">
        {project.name}
      </h3>

      {/* Location and type */}
      <div className="space-y-1 mb-3">
        {(project.location_city || typeLabel) && (
          <div className="flex items-center gap-1.5">
            <MapPin size={12} className="text-white/30 shrink-0" />
            <span className="text-xs text-white/50">
              {[project.location_city, typeLabel].filter(Boolean).join(" • ")}
            </span>
          </div>
        )}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer meta */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/6">
        <div className="flex items-center gap-1">
          <Calendar size={11} className="text-white/25 shrink-0" />
          <span className="text-xs text-white/40">{formatDate(project.created_at)}</span>
        </div>
        
        {project.plot_area_sqft && (
          <div className="flex items-center gap-1">
            <Layers size={11} className="text-white/25 shrink-0" />
            <span className="text-xs text-white/40">
              {Math.round(project.plot_area_sqft).toLocaleString()} sqft
            </span>
          </div>
        )}
      </div>

      {/* Hover actions */}
      {isHovered && (
        <div className="absolute inset-x-5 bottom-5 flex gap-2 bg-[#0a0b10]/90 backdrop-blur-sm rounded-lg p-2 border border-white/10">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 gap-2 text-xs"
            onClick={handleViewResults}
          >
            <Eye size={14} />
            View Results →
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 size={14} />
            {isDeleting ? "..." : "Delete"}
          </Button>
        </div>
      )}
    </div>
  )
}
