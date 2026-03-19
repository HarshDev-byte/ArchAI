"use client"

import Link from "next/link"
import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Building2, MapPin, Calendar, ChevronRight, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ProjectRow, ProjectStatus, ProjectType } from "@/types/database"

// ── Status display map ────────────────────────────────────────

const STATUS_CONFIG: Record<
  ProjectStatus,
  { label: string; variant: "draft" | "feasibility" | "layouts" | "exported"; dot: boolean }
> = {
  draft:               { label: "Draft",            variant: "draft",       dot: false },
  feasibility_done:    { label: "Feasibility Done", variant: "feasibility", dot: true  },
  layouts_generated:   { label: "Layouts Ready",    variant: "layouts",     dot: true  },
  exported:            { label: "Exported",          variant: "exported",    dot: true  },
}

const TYPE_LABEL: Record<ProjectType, string> = {
  apartment:  "Apartment",
  bungalow:   "Bungalow",
  villa:      "Villa",
  mixed_use:  "Mixed Use",
  township:   "Township",
}

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true })
  } catch {
    return "—"
  }
}

// ────────────────────────────────────────────────────────────
// ProjectCard
// ────────────────────────────────────────────────────────────

interface ProjectCardProps {
  project: ProjectRow
}

export function ProjectCard({ project }: ProjectCardProps) {
  const status = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.draft
  const typeLabel = project.project_type
    ? TYPE_LABEL[project.project_type as ProjectType]
    : null

  return (
    <Link
      href={`/dashboard/projects/${project.id}`}
      className="group relative flex flex-col rounded-2xl border border-white/7 bg-white/3 p-5 transition-all duration-200 hover:bg-white/5 hover:border-[#7F77DD]/25 hover:shadow-lg hover:shadow-[#7F77DD]/5"
    >
      {/* Status badge */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <Badge variant={status.variant} dot={status.dot}>
          {status.label}
        </Badge>
        <ChevronRight
          size={15}
          className="text-white/20 group-hover:text-[#7F77DD] group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-0.5"
        />
      </div>

      {/* Project name */}
      <h3 className="font-semibold text-white leading-tight mb-1 line-clamp-2 group-hover:text-[#9990e8] transition-colors">
        {project.name}
      </h3>

      {/* Type */}
      {typeLabel && (
        <div className="flex items-center gap-1.5 mb-3">
          <Building2 size={12} className="text-white/30 shrink-0" />
          <span className="text-xs text-white/40">{typeLabel}</span>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Footer meta */}
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/6 flex-wrap">
        {(project.location_city || project.location_state) && (
          <div className="flex items-center gap-1 min-w-0">
            <MapPin size={11} className="text-white/25 shrink-0" />
            <span className="text-xs text-white/40 truncate">
              {[project.location_city, project.location_state].filter(Boolean).join(", ")}
            </span>
          </div>
        )}

        {project.plot_area_sqft && (
          <div className="flex items-center gap-1">
            <Layers size={11} className="text-white/25 shrink-0" />
            <span className="text-xs text-white/40">
              {project.plot_area_sqft.toLocaleString()} sqft
            </span>
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
          <Calendar size={11} className="text-white/25 shrink-0" />
          <span className="text-xs text-white/30">{formatDate(project.created_at)}</span>
        </div>
      </div>
    </Link>
  )
}
