"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Plus, FolderOpen, BarChart3, Calendar, MapPin, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MetricCard } from "@/components/dashboard/MetricCard"
import { ProjectCard } from "@/components/dashboard/ProjectCard"
import { EmptyState } from "@/components/dashboard/EmptyState"
import { useUser } from "@/hooks/use-user"
import { useProjects, useCreateProject } from "@/hooks/use-projects"
import { toastSuccess, toastError } from "@/lib/toast"
import type { ProjectRow } from "@/types/database"

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

// ── Metric card skeleton ──────────────────────────────────────
function MetricSkeleton() {
  return (
    <div className="rounded-2xl border border-white/6 bg-white/3 p-5 animate-pulse space-y-3">
      <div className="h-10 w-10 rounded-xl bg-white/6" />
      <div className="h-7 w-16 rounded bg-white/6" />
      <div className="h-3 w-24 rounded bg-white/5" />
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
            id="modal-create-project"
            className="flex-1"
            onClick={() => name.trim() && onCreate(name.trim())}
            disabled={!name.trim()}
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
// Dashboard Page
// ────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter()
  const { user, profile } = useUser()
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading: projectsLoading } = useProjects()
  const createProject = useCreateProject()

  const projects: ProjectRow[] = data?.projects ?? []

  // ── Computed metrics ────────────────────────────────────────
  const metrics = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const thisMonth = projects.filter(
      (p) => new Date(p.created_at) >= startOfMonth
    ).length

    const lastCity = projects.find((p) => p.location_city)?.location_city ?? "—"

    const remaining = profile
      ? Math.max(0, profile.designs_limit - profile.designs_used)
      : null

    return { thisMonth, lastCity, remaining }
  }, [projects, profile])

  // ── Create project handler ──────────────────────────────────
  async function handleCreate(name: string) {
    try {
      const newProject = await createProject.mutateAsync({ name })
      toastSuccess(`Project "${name}" created successfully!`)
      setShowModal(false)
      router.push(`/dashboard/projects/${newProject.id}`)
    } catch (error) {
      console.error("Failed to create project:", error)
      toastError("Failed to create project. Please try again.")
    }
  }

  // ── Greeting ────────────────────────────────────────────────
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"
  const firstName = profile?.full_name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "there"

  // ── Render ──────────────────────────────────────────────────
  return (
    <>
      {/* ── New project modal ── */}
      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
          isLoading={createProject.isPending}
        />
      )}

      <div className="mx-auto max-w-7xl space-y-8">
        {/* ── Page header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">
              {greeting}, {firstName} 👋
            </h1>
            <p className="mt-1 text-sm text-white/40">
              {projects.length === 0
                ? "Start your first design project."
                : `You have ${projects.length} project${projects.length !== 1 ? "s" : ""}.`}
            </p>
          </div>

          <Button
            id="btn-new-project"
            size="lg"
            className="gap-2 shrink-0 shadow-lg shadow-[#7F77DD]/20"
            onClick={() => setShowModal(true)}
          >
            <Plus size={18} />
            New Project
          </Button>
        </div>

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {projectsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          ) : (
            <>
              <MetricCard
                label="Total Projects"
                value={data?.total ?? 0}
                icon={FolderOpen}
                iconColor="#7F77DD"
                trend={{ value: metrics.thisMonth, label: "this month" }}
              />
              <MetricCard
                label="This Month"
                value={metrics.thisMonth}
                icon={Calendar}
                iconColor="#60a5fa"
                sub="new projects"
              />
              <MetricCard
                label="Designs Left"
                value={metrics.remaining ?? "—"}
                icon={Zap}
                iconColor={
                  metrics.remaining === 0
                    ? "#f87171"
                    : metrics.remaining !== null && metrics.remaining <= 2
                    ? "#fb923c"
                    : "#34d399"
                }
                sub={`of ${profile?.designs_limit ?? "—"} total`}
              />
              <MetricCard
                label="Last Active City"
                value={metrics.lastCity}
                icon={MapPin}
                iconColor="#a78bfa"
              />
            </>
          )}
        </div>

        {/* ── Projects section ── */}
        <div>
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <BarChart3 size={16} className="text-[#7F77DD]" />
              Recent Projects
            </h2>
            {projects.length > 0 && (
              <button className="text-sm text-[#7F77DD] hover:text-[#9990e8] transition-colors">
                View all →
              </button>
            )}
          </div>

          {/* Grid */}
          {projectsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ProjectCardSkeleton key={i} />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <EmptyState
              onCreateProject={() => setShowModal(true)}
              isLoading={createProject.isPending}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
