"use client";

import { motion } from "framer-motion";
import { Check, ChevronRight, TrendingUp, Layers, Users } from "lucide-react";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface UnitMixItem {
  type:      string;
  count:     number;
  area_sqft: number;
}

export interface LayoutFloorPlan {
  footprint:          { shape: string; width_ft: number; depth_ft: number };
  floors:             number;
  ground_floor_uses:  string[];
  structural_notes:   string;
  design_philosophy:  string;
  strengths:          string[];
  limitations:        string[];
}

export interface LayoutRecord {
  id:                       string;
  project_id:               string;
  design_seed:              number;
  concept_name:             string;
  floor_plan:               LayoutFloorPlan;
  unit_mix:                 UnitMixItem[];
  amenities:                { list: string[] };
  total_units:              number;
  construction_cost_inr:    number;
  sale_revenue_inr:         number;
  roi_pct:                  number;
  is_selected:              boolean;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toCr(inr: number): string {
  const cr = inr / 1_00_00_000;
  return `₹${cr.toFixed(1)} Cr`;
}

function unitMixSummary(mix: UnitMixItem[]): string {
  return mix
    .filter((u) => u.count > 0)
    .map((u) => `${u.count} × ${u.type}`)
    .join(" · ");
}

function footprintLabel(shape: string): string {
  const map: Record<string, string> = {
    rectangular: "Rectangle",
    "l-shaped":  "L-Shape",
    "u-shaped":  "U-Shape",
    tower:       "Tower",
    courtyard:   "Courtyard",
    "y-shaped":  "Y-Shape",
  };
  return map[shape.toLowerCase()] ?? shape;
}

const SEED_COLORS: Record<string, { border: string; glow: string; badge: string }> = {
  compact: {
    border: "border-blue-500/40",
    glow:   "shadow-blue-500/10",
    badge:  "bg-blue-500/15 text-blue-300",
  },
  balanced: {
    border: "border-[#7F77DD]/40",
    glow:   "shadow-[#7F77DD]/10",
    badge:  "bg-[#7F77DD]/15 text-[#7F77DD]",
  },
  premium: {
    border: "border-amber-500/40",
    glow:   "shadow-amber-500/10",
    badge:  "bg-amber-500/15 text-amber-300",
  },
};

function seedTier(seed: number): keyof typeof SEED_COLORS {
  if (seed < 33)  return "compact";
  if (seed < 67)  return "balanced";
  return "premium";
}

const TIER_LABELS: Record<string, string> = {
  compact:  "Max Density",
  balanced: "Balanced",
  premium:  "Premium",
};

// ─────────────────────────────────────────────────────────────
// Single Layout Card
// ─────────────────────────────────────────────────────────────

interface LayoutCardProps {
  layout:       LayoutRecord;
  index:        number;
  isSelected:   boolean;
  isPending:    boolean;
  onSelect:     (id: string) => void;
}

function LayoutCard({ layout, index, isSelected, isPending, onSelect }: LayoutCardProps) {
  const tier    = seedTier(layout.design_seed);
  const colors  = SEED_COLORS[tier];
  const fp      = layout.floor_plan;
  const summary = unitMixSummary(layout.unit_mix);
  const roiPos  = layout.roi_pct >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={() => !isPending && onSelect(layout.id)}
      className={cn(
        "relative group rounded-2xl border p-4 cursor-pointer transition-all duration-200",
        "hover:bg-white/3",
        isSelected
          ? `${colors.border} bg-white/4 shadow-lg ${colors.glow}`
          : "border-white/8 bg-white/1.5",
      )}
    >
      {/* Selected indicator */}
      {isSelected && (
        <motion.div
          layoutId="selected-ring"
          className={cn(
            "absolute inset-0 rounded-2xl border-2 pointer-events-none",
            colors.border,
          )}
        />
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {/* Tier badge */}
            <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", colors.badge)}>
              {TIER_LABELS[tier]}
            </span>
            {/* Footprint badge */}
            <span className="text-[10px] text-white/35 border border-white/10 px-2 py-0.5 rounded-full">
              {footprintLabel(fp.footprint.shape)}
            </span>
          </div>
          <h3 className="text-sm font-bold text-white leading-tight pr-2">
            {layout.concept_name}
          </h3>
          <p className="text-[11px] text-white/40 mt-0.5 leading-snug line-clamp-1">
            {fp.design_philosophy}
          </p>
        </div>

        {/* Floor count badge */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-white/4 border border-white/8
                        flex flex-col items-center justify-center">
          <span className="text-sm font-black text-white leading-none">{fp.floors}</span>
          <span className="text-[8px] text-white/35 leading-none">fl</span>
        </div>
      </div>

      {/* Unit mix */}
      <div className="flex items-center gap-1.5 mb-3">
        <Users size={10} className="text-white/35 shrink-0" />
        <p className="text-[11px] text-white/55 truncate">
          {summary} ={" "}
          <span className="font-semibold text-white/80">{layout.total_units} units</span>
        </p>
      </div>

      {/* Financial stats row */}
      <div className="grid grid-cols-4 gap-1.5 mb-3">
        {[
          { label: "Cost",     value: toCr(layout.construction_cost_inr) },
          { label: "Revenue",  value: toCr(layout.sale_revenue_inr) },
          { label: "ROI",      value: `${layout.roi_pct.toFixed(0)}%` },
          { label: "Floors",   value: `${fp.floors} fl` },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-lg bg-white/3 border border-white/5 px-1.5 py-1.5 text-center"
          >
            <p className="text-[9px] text-white/30 mb-0.5">{label}</p>
            <p className={cn(
              "text-[11px] font-bold leading-none",
              label === "ROI"
                ? roiPos ? "text-emerald-400" : "text-red-400"
                : "text-white",
            )}>
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Strengths + Limitations chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {fp.strengths.slice(0, 2).map((s, i) => (
          <span
            key={i}
            className="text-[10px] text-emerald-300 bg-emerald-500/8 border
                       border-emerald-500/20 rounded-full px-2 py-0.5"
          >
            ✓ {s}
          </span>
        ))}
        {fp.limitations.slice(0, 1).map((l, i) => (
          <span
            key={i}
            className="text-[10px] text-amber-300 bg-amber-500/8 border
                       border-amber-500/20 rounded-full px-2 py-0.5"
          >
            ⚠ {l}
          </span>
        ))}
      </div>

      {/* Select button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        disabled={isPending}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(layout.id);
        }}
        className={cn(
          "w-full text-xs font-semibold py-2 rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5",
          isSelected
            ? "bg-[#7F77DD] text-white"
            : "bg-white/5 border border-white/10 text-white/60 hover:bg-white/10 hover:text-white",
          isPending && "opacity-50 cursor-not-allowed",
        )}
      >
        {isSelected ? (
          <>
            <Check size={12} />
            Selected
          </>
        ) : (
          <>
            Select
            <ChevronRight size={12} />
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// LayoutSelector — 3 stacked cards
// ─────────────────────────────────────────────────────────────

interface LayoutSelectorProps {
  layouts:          LayoutRecord[];
  selectedLayoutId: string | null;
  pendingLayoutId:  string | null;
  onSelect:         (id: string) => void;
}

export function LayoutSelector({
  layouts,
  selectedLayoutId,
  pendingLayoutId,
  onSelect,
}: LayoutSelectorProps) {
  if (layouts.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/2 p-6 text-center">
        <Layers size={24} className="mx-auto mb-2 text-white/20" />
        <p className="text-sm text-white/40">No layouts generated yet.</p>
        <p className="text-xs text-white/25 mt-0.5">Run the generation step first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {layouts.map((layout, i) => (
        <LayoutCard
          key={layout.id}
          layout={layout}
          index={i}
          isSelected={layout.id === selectedLayoutId}
          isPending={layout.id === pendingLayoutId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
