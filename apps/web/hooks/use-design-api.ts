"use client";

import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useProjectStore } from "@/store/project";
import type { ParcelFeature, FeasibilityResult, BuildingLayout } from "@/types/database";
import toast from "react-hot-toast";

// ─────────────────────────────────────────────────────────────
// Feasibility check mutation
// ─────────────────────────────────────────────────────────────

export function useFeasibilityCheck() {
  const { setFeasibilityStatus, setFeasibilityResult, setGenerationError } =
    useProjectStore();

  return useMutation({
    mutationFn: async (parcel: ParcelFeature) => {
      const { data } = await apiClient.post<FeasibilityResult>(
        "/api/v1/feasibility",
        { parcel_geojson: parcel }
      );
      return data;
    },
    onMutate: () => {
      setFeasibilityStatus("pending");
      toast.loading("Running AI feasibility check…", { id: "feasibility" });
    },
    onSuccess: (result) => {
      setFeasibilityResult(result);
      toast.success("Feasibility check complete!", { id: "feasibility" });
    },
    onError: (error: Error) => {
      setGenerationError(error.message);
      toast.error(`Feasibility failed: ${error.message}`, { id: "feasibility" });
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Layout generation mutation
// ─────────────────────────────────────────────────────────────

export function useGenerateLayouts() {
  const { setLayouts, setIsGenerating, setGenerationError } = useProjectStore();

  return useMutation({
    mutationFn: async (parcel: ParcelFeature) => {
      const { data } = await apiClient.post<BuildingLayout[]>(
        "/api/v1/layouts/generate",
        { parcel_geojson: parcel }
      );
      return data;
    },
    onMutate: () => {
      setIsGenerating(true);
      toast.loading("Generating layout configurations…", { id: "layouts" });
    },
    onSuccess: (layouts) => {
      setLayouts(layouts);
      setIsGenerating(false);
      toast.success(`${layouts.length} layouts generated!`, { id: "layouts" });
    },
    onError: (error: Error) => {
      setGenerationError(error.message);
      toast.error(`Layout generation failed: ${error.message}`, { id: "layouts" });
    },
  });
}
