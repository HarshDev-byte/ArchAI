"use client";

import { use, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Building2, AlertTriangle,
  RotateCcw, TrendingUp, Users, Layers,
  BarChart2, TableProperties,
} from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { useProjectStore } from "@/store/project";
import { FeasibilityCard }  from "@/components/results/FeasibilityCard";
import { LayoutSelector }   from "@/components/results/LayoutSelector";
import { ComparisonTable }  from "@/components/results/ComparisonTable";
import { PricingCard }      from "@/components/results/PricingCard";
import { ExportBar }        from "@/components/results/ExportBar";
import { ThreeDErrorBoundary, DataErrorBoundary } from "@/components/ui/error-boundary";
import { ResultsPageSkeleton, ThreeDViewerSkeleton } from "@/components/ui/skeleton";
import { toastSuccess, toastError } from "@/lib/toast";
import type { LayoutRecord }      from "@/components/results/LayoutSelector";
import type { FeasibilityReport } from "@/components/results/FeasibilityCard";

// ─────────────────────────────────────────────────────────────
// Dynamic import — Three.js cannot run on SSR
// ─────────────────────────────────────────────────────────────

const BuildingPreview3D = dynamic(
  () => import("@/components/results/BuildingPreview3D"),
  {
    ssr: false,
    loading: () => <ThreeDViewerSkeleton />,
  }
);

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ProjectDetail {
  id:                    string;
  name:                  string;
  status:                string;
  project_type:          string | null;
  location_city:         string | null;
  location_state:        string | null;
  plot_area_sqft:        number | null;
  floors_requested:      number | null;
  feasibility_report:    FeasibilityReport | null;
  layout_configurations: LayoutRecord[];
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getAuthToken(): Promise<string> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

function statusColor(status: string): string {
  switch (status) {
    case "feasibility_done":  return "bg-emerald-500/15 text-emerald-300 border-emerald-500/25";
    case "layouts_generated": return "bg-[#7F77DD]/15 text-[#7F77DD] border-[#7F77DD]/25";
    case "exported":          return "bg-amber-500/15 text-amber-300 border-amber-500/25";
    default:                  return "bg-white/8 text-white/50 border-white/12";
  }
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft:             "Draft",
    feasibility_done:  "Feasibility Done",
    layouts_generated: "Layouts Ready",
    exported:          "Exported",
  };
  return map[status] ?? status;
}

function toCr(inr: number): string {
  return `₹${(inr / 1_00_00_000).toFixed(1)} Cr`;
}

// ─────────────────────────────────────────────────────────────
// Right panel tabs
// ─────────────────────────────────────────────────────────────

type RightTab = "overview" | "compare" | "pricing";

const RIGHT_TABS: { key: RightTab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview",   icon: <Building2 size={12} />    },
  { key: "compare",  label: "Compare",    icon: <TableProperties size={12} /> },
  { key: "pricing",  label: "Pricing",    icon: <BarChart2 size={12} />    },
];

// ─────────────────────────────────────────────────────────────
// Layout detail panel (overview tab)
// ─────────────────────────────────────────────────────────────

function LayoutDetailPanel({ layout }: { layout: LayoutRecord | null }) {
  if (!layout) return null;
  const fp = layout.floor_plan;

  return (
    <motion.div
      key={layout.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3 px-1"
    >
      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: <Layers size={12} />,     label: "Floors",      value: `${fp.floors}` },
          { icon: <Users size={12} />,      label: "Total units", value: `${layout.total_units}` },
          { icon: <TrendingUp size={12} />, label: "ROI",         value: `${layout.roi_pct.toFixed(1)}%` },
        ].map(({ icon, label, value }) => (
          <div
            key={label}
            className="rounded-xl bg-white/4 border border-white/8 px-3 py-2.5 flex items-center gap-2"
          >
            <span className="text-[#7F77DD]">{icon}</span>
            <div>
              <p className="text-[9px] text-white/35">{label}</p>
              <p className="text-sm font-bold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Unit mix viz */}
      <div className="rounded-xl border border-white/6 bg-white/2 p-3 space-y-2">
        <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">
          Unit Mix
        </p>
        {layout.unit_mix.filter(u => u.count > 0).map((u, i) => {
          const pct = layout.total_units > 0 ? (u.count / layout.total_units) * 100 : 0;
          return (
            <div key={i} className="space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-white/60">{u.type}</span>
                <span className="text-white font-semibold">
                  {u.count} units · {u.area_sqft.toFixed(0)} sqft
                </span>
              </div>
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1 }}
                  className="h-full bg-[#7F77DD] rounded-full"
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Financial summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
          <p className="text-[9px] text-white/35 mb-0.5">Construction</p>
          <p className="text-sm font-bold text-white">{toCr(layout.construction_cost_inr)}</p>
        </div>
        <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
          <p className="text-[9px] text-white/35 mb-0.5">Est. Revenue</p>
          <p className="text-sm font-bold text-white">{toCr(layout.sale_revenue_inr)}</p>
        </div>
      </div>

      {/* Ground floor uses */}
      {fp.ground_floor_uses?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">
            Ground floor
          </p>
          <div className="flex flex-wrap gap-1.5">
            {fp.ground_floor_uses.map((use, i) => (
              <span
                key={i}
                className="text-[10px] text-white/55 bg-white/4 border border-white/8 rounded-full px-2 py-0.5 capitalize"
              >
                {use}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Amenities */}
      {layout.amenities?.list?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider">
            Amenities ({layout.amenities.list.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {layout.amenities.list.map((a, i) => (
              <span
                key={i}
                className="text-[10px] text-[#7F77DD] bg-[#7F77DD]/8 border border-[#7F77DD]/20 rounded-full px-2 py-0.5"
              >
                {a}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Results Page
// ─────────────────────────────────────────────────────────────

export default function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [pendingLayoutId,  setPendingLayoutId]  = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("overview");

  const { selectLayout } = useProjectStore();

  // ── Fetch project data ───────────────────────────────────────────────────
  const { data: project, isLoading, error } = useQuery<ProjectDetail>({
    queryKey: ["project", id],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch(`${API}/api/v1/projects/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Failed to load project: ${res.status}`);
      const data = await res.json();

      // Pre-select the first is_selected layout
      const selected = data.layout_configurations?.find((l: LayoutRecord) => l.is_selected);
      if (selected) setSelectedLayoutId(selected.id);
      else if (data.layout_configurations?.[0]) setSelectedLayoutId(data.layout_configurations[0].id);

      return data;
    },
    refetchOnWindowFocus: false,
  });

  // ── Select layout mutation ────────────────────────────────────────────────
  const selectMutation = useMutation({
    mutationFn: async (layoutId: string) => {
      const token = await getAuthToken();
      const res = await fetch(`${API}/api/v1/layouts/${layoutId}/select`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Select failed: ${res.status}`);
      return res.json();
    },
    onMutate: (layoutId) => {
      setPendingLayoutId(layoutId);
      setSelectedLayoutId(layoutId);
    },
    onSuccess: () => {
      toastSuccess("Layout selected successfully!");
      queryClient.invalidateQueries({ queryKey: ["project", id] });
    },
    onError: (error) => {
      console.error("Failed to select layout:", error);
      toastError("Failed to select layout. Please try again.");
    },
    onSettled: () => setPendingLayoutId(null),
  });

  const handleSelect = useCallback((layoutId: string) => {
    if (layoutId === selectedLayoutId) return;
    const layout = project?.layout_configurations.find(l => l.id === layoutId);
    if (layout) selectLayout(layout as any); // Type assertion for compatibility
    selectMutation.mutate(layoutId);
  }, [selectedLayoutId, project, selectMutation, selectLayout]);

  const selectedLayout = project?.layout_configurations.find(
    l => l.id === selectedLayoutId
  ) ?? null;

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0d0f14] flex flex-col">
        {/* Top bar skeleton */}
        <div className="h-14 border-b border-white/6 bg-[#0d0f14]/90 flex items-center px-4 gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-5 w-40 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-5 w-20 rounded-full bg-white/5 animate-pulse" />
        </div>
        <div className="flex-1 p-6">
          <ResultsPageSkeleton />
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error || !project) {
    return (
      <div className="min-h-screen bg-[#0d0f14] flex items-center justify-center">
        <div className="text-center space-y-3 max-w-sm px-6">
          <AlertTriangle size={32} className="mx-auto text-red-400" />
          <p className="text-white font-semibold">Could not load project</p>
          <p className="text-sm text-white/40">{(error as Error)?.message ?? "Unknown error"}</p>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["project", id] })}
            className="inline-flex items-center gap-1.5 text-sm text-[#7F77DD] hover:underline"
          >
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      </div>
    );
  }

  const feasibility = project.feasibility_report;
  const layouts     = project.layout_configurations ?? [];

  return (
    <div className="min-h-screen bg-[#0d0f14] flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="h-14 border-b border-white/6 bg-[#0d0f14]/90 backdrop-blur-lg
                         flex items-center px-4 shrink-0 z-20">
        <button
          onClick={() => router.push("/dashboard")}
          className="mr-3 w-8 h-8 rounded-lg flex items-center justify-center
                     hover:bg-white/8 transition-colors text-white/50 hover:text-white"
        >
          <ArrowLeft size={16} />
        </button>

        <div className="flex items-center gap-3 flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{project.name}</p>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                           ${statusColor(project.status)}`}>
            {statusLabel(project.status)}
          </span>
          {project.location_city && (
            <span className="text-xs text-white/35 hidden sm:block">
              {project.location_city}
            </span>
          )}
        </div>
      </header>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      {/* On mobile: single column. On md+: side-by-side */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">

          {/* ── LEFT PANEL — sidebar on desktop, top section on mobile ── */}
          <aside className="w-full md:w-[40%] md:min-w-[300px] md:max-w-[500px]
                            border-b md:border-b-0 md:border-r border-white/6
                            overflow-y-auto flex-shrink-0 bg-[#0a0c11]
                            max-h-[45vh] md:max-h-none">
            <div className="p-5 space-y-6">

              {/* Feasibility section */}
              <section>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
                  Feasibility Analysis
                </h2>
                <DataErrorBoundary>
                  {feasibility ? (
                    <FeasibilityCard report={feasibility} projectId={id} />
                  ) : (
                    <div className="rounded-xl border border-white/8 bg-white/2 px-4 py-5 text-center">
                      <AlertTriangle size={20} className="mx-auto mb-2 text-amber-400/60" />
                      <p className="text-sm text-white/40">No feasibility report yet.</p>
                    </div>
                  )}
                </DataErrorBoundary>
              </section>

              {/* Layouts section — only if feasible */}
              {feasibility?.is_feasible && (
                <section>
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-3">
                    Layout Configurations
                  </h2>
                  <DataErrorBoundary>
                    <LayoutSelector
                      layouts={layouts}
                      selectedLayoutId={selectedLayoutId}
                      pendingLayoutId={pendingLayoutId}
                      onSelect={handleSelect}
                    />
                  </DataErrorBoundary>
                </section>
              )}
            </div>
          </aside>

          {/* ── RIGHT PANEL — 60% ── */}
          <main className="flex-1 flex flex-col overflow-hidden">

            {/* 3D viewer — fixed height */}
            <div
              className="relative bg-gradient-to-b from-[#0d0f14] to-[#080a0f]
                         border-b border-white/5 flex-shrink-0"
              style={{ height: "340px" }}
            >
              {/* Gradient vignette */}
              <div className="pointer-events-none absolute inset-0 z-10
                              bg-[radial-gradient(ellipse_at_center,transparent_60%,#080a0f_100%)]" />

              <ThreeDErrorBoundary>
                <BuildingPreview3D layout={selectedLayout} />
              </ThreeDErrorBoundary>

              {/* Floating concept label */}
              {selectedLayout && (
                <motion.div
                  key={selectedLayout.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-4 left-4 z-20 pointer-events-none"
                >
                  <div className="rounded-xl bg-black/50 backdrop-blur-md border border-white/10 px-3 py-2">
                    <p className="text-xs font-bold text-white">{selectedLayout.concept_name}</p>
                    <p className="text-[10px] text-white/45">
                      {selectedLayout.floor_plan.floors} floors · {selectedLayout.total_units} units
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Controls hint */}
              <div className="absolute bottom-3 right-3 z-20 pointer-events-none">
                <p className="text-[10px] text-white/20">drag to rotate · scroll to zoom</p>
              </div>
            </div>

            {/* ── Tab bar ── */}
            <div className="flex-shrink-0 flex items-center gap-1 px-4 pt-3 pb-0 bg-[#0a0c11] border-b border-white/6">
              {RIGHT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  onClick={() => setRightTab(tab.key)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-t-xl text-[11px] font-semibold
                             border-b-2 transition-all duration-150 select-none"
                  style={{
                    borderBottomColor: rightTab === tab.key ? "#7F77DD" : "transparent",
                    color:             rightTab === tab.key ? "#a5b4fc"  : "rgba(255,255,255,0.30)",
                    background:        rightTab === tab.key ? "rgba(127,119,221,0.08)" : "transparent",
                  }}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ── Tab content ── */}
            <div className="flex-1 overflow-y-auto bg-[#0a0c11] p-4">
              <AnimatePresence mode="wait">
                {rightTab === "overview" && (
                  <motion.div
                    key="overview"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {selectedLayout ? (
                      <LayoutDetailPanel key={selectedLayout.id} layout={selectedLayout} />
                    ) : (
                      <div className="h-full flex items-center justify-center pt-12">
                        <p className="text-xs text-white/25">Select a layout to see details</p>
                      </div>
                    )}
                  </motion.div>
                )}

                {rightTab === "compare" && (
                  <motion.div
                    key="compare"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ComparisonTable
                      layouts={layouts}
                      selectedLayoutId={selectedLayoutId}
                      onSelect={handleSelect}
                    />
                  </motion.div>
                )}

                {rightTab === "pricing" && (
                  <motion.div
                    key="pricing"
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <PricingCard layout={selectedLayout} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </main>
        </div>

        {/* ── Sticky Export Bar ── */}
        <ExportBar layout={selectedLayout} projectId={id} />
      </div>
    </div>
  );
}
