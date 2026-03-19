"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { apiClient } from "@/lib/api-client"
import type { ProjectRow } from "@/types/database"
import toast from "react-hot-toast"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface ProjectListResponse {
  projects: ProjectRow[]
  total: number
  page: number
  page_size: number
}

export interface ProjectCreatePayload {
  name: string
  project_type?: string
  location_city?: string
  location_state?: string
  location_lat?: number
  location_lng?: number
  floors_requested?: number
}

// ─────────────────────────────────────────────────────────────
// Token getter — reads the current Supabase session access token
// ─────────────────────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error("Not authenticated")
  return session.access_token
}

// ─────────────────────────────────────────────────────────────
// Query keys
// ─────────────────────────────────────────────────────────────

export const projectKeys = {
  all: ["projects"] as const,
  list: (page = 1) => [...projectKeys.all, "list", page] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
}

// ─────────────────────────────────────────────────────────────
// useProjects — list with pagination
// ─────────────────────────────────────────────────────────────

export function useProjects(page = 1) {
  return useQuery({
    queryKey: projectKeys.list(page),
    queryFn: async (): Promise<ProjectListResponse> => {
      const token = await getAccessToken()
      const { data } = await apiClient.get<ProjectListResponse>(
        `/api/v1/projects/?page=${page}&page_size=20`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return data
    },
    staleTime: 60_000,  // 1 min
  })
}

// ─────────────────────────────────────────────────────────────
// useProject — single project with all related data
// ─────────────────────────────────────────────────────────────

export function useProject(projectId: string | null) {
  return useQuery({
    queryKey: projectKeys.detail(projectId ?? ""),
    enabled: !!projectId,
    queryFn: async () => {
      const token = await getAccessToken()
      const { data } = await apiClient.get(
        `/api/v1/projects/${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return data
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useCreateProject
// ─────────────────────────────────────────────────────────────

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: ProjectCreatePayload): Promise<ProjectRow> => {
      const token = await getAccessToken()
      const { data } = await apiClient.post<ProjectRow>(
        "/api/v1/projects/",
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      return data
    },
    onSuccess: (newProject) => {
      // Invalidate the list so it refetches
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      toast.success(`Project "${newProject.name}" created!`)
    },
    onError: (error: Error) => {
      toast.error(`Failed to create project: ${error.message}`)
    },
  })
}

// ─────────────────────────────────────────────────────────────
// useDeleteProject
// ─────────────────────────────────────────────────────────────

export function useDeleteProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (projectId: string) => {
      const token = await getAccessToken()
      await apiClient.delete(`/api/v1/projects/${projectId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return projectId
    },
    onSuccess: (deletedId) => {
      queryClient.removeQueries({ queryKey: projectKeys.detail(deletedId) })
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
      toast.success("Project deleted.")
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`)
    },
  })
}
