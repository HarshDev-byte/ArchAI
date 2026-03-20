"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Filter, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProjectCard } from "@/components/dashboard/ProjectCard"
import { EmptyState } from "@/components/dashboard/EmptyState"
import { useProjects, useCreateProject } from "@/hooks/use-projects"
import { cn } from "@/lib/utils"

// ── Skeleton loader for project cards ────────────────────────
function ProjectCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/3 p-5 animate-pulse space-y-3">
      <div className="h-5 w-24 rounded-full bg-white/6" />
      <div className="h-4 w-3/4 rounded bg-white/6" />
      <div className="h-3 w-1/2 rounded bg-white/5" />
      <div className="pt-4 border-t border-white/5 flex gap-3">
        <div className="h-3 w-20 rounded bg-white/5" />
        <div className="h-3 w-16 rounded bg-white/5 ml-auto" />
      </div>
    </div>
  )
}

// ── New project modal ─────────────────────────────────────────
function NewProjectModal({
  onClose,
  onCreate,
  isLoading,
}: {
  onClose: () => void
  onCreate: (name: string) => void
  isLoading: boolean
}) {
  const [name, setName] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#15181f] p-6 shadow-2xl shadow-black/60">
        <h2 className="text-lg font-semibold text-white mb-1">New Project</h2>
        <p className="text-sm text-white/40 mb-5">
          Give your project a name. You can rename it anytime.
        </p>

        <label htmlFor="project-name" className="text-sm font-medium text-white/60 mb-1.5 block">
          Project name
        </label>
        <input
          id="project-name"
          autoFocus
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onCreate(name.trim())}
          placeholder="e.g. Andheri West Apartment"
          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#7F77DD] focus:ring-offset-1 focus:ring-offset-[#15181f] mb-5"
        />

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => name.trim() && onCreate(name.trim())}
            disabled={!name.trim() || isLoading}
            isLoading={isLoading}
          >
            Create project
          </Button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Projects Page
// ────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router = useRouter()
  const [showModal, setShowModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("")

  const { data, isLoading } = useProjects(statusFilter ? { status: statusFilter } : {})
  const createProject = useCreateProject()

  // Filter projects by search query
  const filteredProjects = data?.projects?.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.location_city?.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? []

  // Create project handler
  async function handleCreate(name: string) {
    try {
      const newProject = await createProject.mutateAsync({ name })
      setShowModal(false)
      router.push(`/dashboard/projects/new?project=${newProject.id}`)
    } catch (error) {
      console.error("Failed to create project:", error)
    }
  }

  const statusFilters = [
    { value: "", label: "All Projects" },
    { value: "draft", label: "Draft" },
    { value: "feasibility_done", label: "Feasibility Done" },
    { value: "layouts_generated", label: "Layouts Generated" },
    { value: "exported", label: "Exported" },
  ]

  return (
    <>
      {/* New project modal */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          isLoading={createProject.isPending}
        />
      )}

      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <p className="mt-1 text-sm text-white/40">
              Manage all your design projects in one place
            </p>
          </div>

          <Button
            size="lg"
            className="gap-2 shrink-0 shadow-lg shadow-[#7F77DD]/20"
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} />
            New Project
          </Button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Status Filter */}
          <div className="flex gap-2">
            {statusFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  "text-xs",
                  statusFilter === filter.value && "bg-[#7F77DD] text-white"
                )}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <ProjectCardSkeleton key={i} />
            ))}
          </div>
        ) : filteredProjects.length === 0 ? (
          searchQuery || statusFilter ? (
            <div className="text-center py-12">
              <div className="text-white/40 mb-4">
                <Filter size={48} className="mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">No projects found</h3>
                <p>Try adjusting your search or filter criteria</p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery("")
                  setStatusFilter("")
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <EmptyState
              onCreateProject={() => setShowModal(true)}
              isLoading={createProject.isPending}
            />
          )
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Results count */}
        {!isLoading && filteredProjects.length > 0 && (
          <div className="text-center text-sm text-white/40">
            Showing {filteredProjects.length} of {data?.total ?? 0} projects
          </div>
        )}
      </div>

      {/* Floating New Project Button */}
      <Button
        onClick={() => setShowModal(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg shadow-[#7F77DD]/20",
          "bg-[#7F77DD] hover:bg-[#9990e8] text-white",
          "transition-all duration-200 hover:scale-105"
        )}
        disabled={createProject.isPending}
      >
        <Plus size={24} />
      </Button>
    </>
  )
}