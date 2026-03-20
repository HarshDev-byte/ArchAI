"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import type { ProjectRow } from "@/types/database"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ProjectWithCounts extends ProjectRow {
  feasibility_count: number
  layout_count: number
  latest_feasibility?: any
}

export interface ProjectListResponse {
  projects: ProjectWithCounts[]
  total: number
}

export interface ProjectDetailResponse {
  project: ProjectWithCounts
  feasibility_reports: any[]
  layout_configurations: any[]
}

export interface CreateProjectRequest {
  name: string
  plot_geojson?: any
  plot_area_sqft?: number
  plot_length_ft?: number
  plot_width_ft?: number
  location_city?: string
  location_state?: string
  location_lat?: number
  location_lng?: number
  project_type?: string
  floors_requested?: number
  requirements?: Record<string, any>
}

// ─────────────────────────────────────────────────────────────
// Query Keys
// ─────────────────────────────────────────────────────────────

const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters: Record<string, any>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
}

// ─────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────

/**
 * Fetch user's projects with optional filtering
 * Auto-refetches every 30 seconds to keep data fresh
 */
export function useProjects(filters: { status?: string } = {}) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: async (): Promise<ProjectListResponse> => {
      const params = new URLSearchParams()
      if (filters.status) {
        params.append("status", filters.status)
      }
      
      const response = await apiClient.get(`/projects?${params.toString()}`)
      return response.data
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  })
}

/**
 * Fetch a single project with all its details
 */
export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async (): Promise<ProjectDetailResponse> => {
      const response = await apiClient.get(`/projects/${id}`)
      return response.data
    },
    enabled: !!id,
  })
}

/**
 * Create a new project
 */
export function useCreateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateProjectRequest): Promise<ProjectWithCounts> => {
      const response = await apiClient.post("/projects", data)
      return response.data
    },
    onSuccess: () => {
      // Invalidate and refetch projects list
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

/**
 * Delete a project
 */
export function useDeleteProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string): Promise<{ success: boolean; message: string }> => {
      const response = await apiClient.delete(`/projects/${id}`)
      return response.data
    },
    onSuccess: (_, deletedId) => {
      // Remove the deleted project from cache
      queryClient.removeQueries({ queryKey: projectKeys.detail(deletedId) })
      // Invalidate projects list to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

/**
 * Update a project
 */
export function useUpdateProject() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ 
      id, 
      data 
    }: { 
      id: string
      data: Partial<CreateProjectRequest> 
    }): Promise<ProjectWithCounts> => {
      const response = await apiClient.patch(`/projects/${id}`, data)
      return response.data
    },
    onSuccess: (updatedProject) => {
      // Update the project in cache
      queryClient.setQueryData(
        projectKeys.detail(updatedProject.id),
        (old: ProjectDetailResponse | undefined) => 
          old ? { ...old, project: updatedProject } : undefined
      )
      // Invalidate projects list to refetch
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Utility Hooks
// ─────────────────────────────────────────────────────────────

/**
 * Get projects filtered by status
 */
export function useProjectsByStatus(status: string) {
  return useProjects({ status })
}

/**
 * Get project metrics for dashboard
 */
export function useProjectMetrics() {
  const { data, isLoading } = useProjects()
  
  const metrics = {
    total: data?.total ?? 0,
    thisMonth: 0,
    lastCity: "—",
  }
  
  if (data?.projects) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    
    metrics.thisMonth = data.projects.filter(
      (p) => new Date(p.created_at) >= startOfMonth
    ).length
    
    const lastProject = data.projects.find((p) => p.location_city)
    metrics.lastCity = lastProject?.location_city ?? "—"
  }
  
  return {
    data: metrics,
    isLoading,
  }
}