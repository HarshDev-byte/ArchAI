"use client"

import { Button } from "@/components/ui/button"
import { Plus, FolderOpen } from "lucide-react"

interface EmptyStateProps {
  onCreateProject: () => void
  isLoading?: boolean
}

export function EmptyState({ onCreateProject, isLoading }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/2 px-8 py-20 text-center">
      {/* Illustration */}
      <div className="relative mb-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#7F77DD]/10 border border-[#7F77DD]/15">
          <FolderOpen size={36} className="text-[#7F77DD]/60" />
        </div>
        {/* Orbiting dot */}
        <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full border-2 border-[#0d0f14] bg-[#7F77DD]/40 flex items-center justify-center">
          <Plus size={10} className="text-white" />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-white mb-2">
        No projects yet
      </h3>
      <p className="text-sm text-white/40 max-w-xs leading-relaxed mb-7">
        Draw a land parcel on the satellite map to get an AI feasibility check
        and 3 unique building layout configurations.
      </p>

      <Button
        id="empty-state-create"
        size="lg"
        onClick={onCreateProject}
        isLoading={isLoading}
        className="gap-2"
      >
        <Plus size={16} />
        Create your first project
      </Button>
    </div>
  )
}
