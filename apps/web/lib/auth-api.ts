import { apiClient } from "./api-client";
import type { ProfileRow } from "@/types/database";

export interface ProfileCreateRequest {
  full_name: string;
  company_name?: string;
  phone?: string;
}

export interface ProfileResponse {
  id: string;
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  plan: string;
  designs_used: number;
  designs_limit: number;
  avatar_url: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export const authApi = {
  /**
   * Create or update the current user's profile
   */
  async createOrUpdateProfile(data: ProfileCreateRequest): Promise<ProfileResponse> {
    const response = await apiClient.post<ProfileResponse>("/api/v1/profiles", data);
    return response.data;
  },

  /**
   * Get the current user's profile
   */
  async getCurrentProfile(): Promise<ProfileResponse> {
    const response = await apiClient.get<ProfileResponse>("/api/v1/profiles/me");
    return response.data;
  },
};