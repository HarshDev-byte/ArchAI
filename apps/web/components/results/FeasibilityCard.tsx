"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, XCircle, AlertTriangle, MapPin, Layers,
  ChevronRight, Building2, ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface Setbacks {
  front_m: number;
  rear_m:  number;
  side_m:  number;
}

export interface ApprovedConfig {
  max_floors:         number;
  recommended_floors: number;
  max_fsi:            number;
  usable_area_sqft:   number;
  floor_plate_sqft:   number;
  setbacks:           Setbacks;
  parking_type:       string;
}

export interface FeasibilityReport {
  id:                string;
  project_id:        string;
  is_feasible:       boolean;
  rejection_reasons: string[];
  warnings:          string[];
  max_floors:        number | null;
  usable_area_sqft:  number | null;
  setbacks:          Setbacks | null;
  raw_claude_response: {
    confidence:       number;
    approved_config:  ApprovedConfig | null;
    regulatory_notes: string;
    nearby_advantages: string[];
  } | null;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toSqft(sqft: number | null | undefined): string {
  if (!sqft) return "—";
  return `${sqft.toLocaleString("en-IN", { maximumFractionDigits: 0 })} sqft`;
}

function parkingLabel(type: string): string {
  const map: Record<string, string> = {
    surface:  "Surface parking",
    stilt:    "Stilt floor parking",
    podium:   "Podium parking",
    basement: "Basement parking",
    none:     "No parking required",
  };
  return map[type] ?? type;
}

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function RejectionCard({ reason, index }: { reason: string; index: number }) {
  // Map common regulation violations to plain-language explanations
  const explanations: Record<string, { short: string; tip: string }> = {
    "minimum plot": {
      short: "Plot too small",
      tip: "Try a different plot, or switch to a Bungalow / Villa project type which needs less land.",
    },
    "fsi": {
      short: "FSI limit exceeded",
      tip: "Reduce the number of floors or floor plate size to stay within the city's Floor Space Index.",
    },
    "setback": {
      short: "Setback violation",
      tip: "Ensure at least 4.5m front, 3m rear, and 2m side clearances from the plot boundary.",
    },
    "ground coverage": {
      short: "Ground coverage too high",
      tip: "Reduce the building footprint. Maximum 40% of plot area can be covered by the building.",
    },
    "swimming pool": {
      short: "Pool needs more space",
      tip: "A swimming pool requires a minimum plot of 3,500 sqft. Consider dropping this amenity.",
    },
    "podium parking": {
      short: "Plot too small for podium parking",
      tip: "Podium parking requires at least 12,000 sqft. Consider stilt or basement parking instead.",
    },
  };

  const lowerReason = reason.toLowerCase();
  const match = Object.entries(explanations).find(([key]) =>
    lowerReason.includes(key)
  );
  const extra = match?.[1];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <XCircle size={14} className="text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-red-300">
          {extra?.short ?? `Issue ${index + 1}`}
        </span>
      </div>
      <p className="text-xs text-white/60 leading-relaxed pl-5">{reason}</p>
      {extra?.tip && (
        <p className="text-xs text-amber-400/80 pl-5 pt-0.5 flex items-start gap-1.5">
          <ChevronRight size={12} className="mt-0.5 shrink-0" />
          {extra.tip}
        </p>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main FeasibilityCard
// ─────────────────────────────────────────────────────────────

interface FeasibilityCardProps {
  report: FeasibilityReport;
  projectId: string;
}

export function FeasibilityCard({ report, projectId }: FeasibilityCardProps) {
  const router = useRouter();
  const cfg    = report.raw_claude_response?.approved_config ?? null;
  const nearby = report.raw_claude_response?.nearby_advantages ?? [];
  const notes  = report.raw_claude_response?.regulatory_notes ?? "";

  // ── Not feasible ──────────────────────────────────────────────────────────
  if (!report.is_feasible) {
    return (
      <div className="space-y-4">
        {/* Red banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center gap-3 rounded-2xl bg-red-500/10 border border-red-500/25
                     px-4 py-4"
        >
          <div className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
            <XCircle size={18} className="text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-red-300">Plot not approved</p>
            <p className="text-xs text-white/40 mt-0.5">
              {report.rejection_reasons.length} issue
              {report.rejection_reasons.length !== 1 ? "s" : ""} found —
              review below and adjust your inputs
            </p>
          </div>
        </motion.div>

        {/* Rejection reason cards */}
        <div className="space-y-2.5">
          {report.rejection_reasons.map((reason, i) => (
            <RejectionCard key={i} reason={reason} index={i} />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={() => router.push(`/dashboard/projects/new?step=3&project_id=${projectId}`)}
            className="flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl
                       border border-amber-500/30 bg-amber-500/8 text-amber-300
                       hover:bg-amber-500/15 transition-colors"
          >
            Modify requirements
          </button>
          <button
            onClick={() => router.push("/dashboard/projects/new?step=1")}
            className="flex-1 text-center text-xs font-semibold py-2.5 px-3 rounded-xl
                       border border-white/10 bg-white/5 text-white/60
                       hover:bg-white/10 transition-colors"
          >
            Try different plot
          </button>
        </div>
      </div>
    );
  }

  // ── Feasible ──────────────────────────────────────────────────────────────
  const setbacks = cfg?.setbacks ?? report.setbacks;

  return (
    <div className="space-y-4">
      {/* Green banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border
                   border-emerald-500/25 px-4 py-4"
      >
        <div className="w-9 h-9 rounded-full bg-emerald-500/15 flex items-center
                        justify-center shrink-0">
          <CheckCircle2 size={18} className="text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-emerald-300">Plot approved ✓</p>
          <p className="text-xs text-white/40 mt-0.5">
            AI confidence:{" "}
            {((report.raw_claude_response?.confidence ?? 0.8) * 100).toFixed(0)}%
          </p>
        </div>
      </motion.div>

      {/* Key stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Max floors",    value: cfg?.max_floors ?? report.max_floors ?? "—" },
          { label: "Recommended",   value: `${cfg?.recommended_floors ?? "—"} fl` },
          { label: "Usable area",   value: toSqft(cfg?.usable_area_sqft ?? report.usable_area_sqft) },
          { label: "Max FSI",       value: cfg?.max_fsi?.toFixed(2) ?? "—" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl bg-white/3 border border-white/6 px-3 py-2.5"
          >
            <p className="text-[10px] text-white/35 mb-0.5">{label}</p>
            <p className="text-sm font-bold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Setbacks */}
      {setbacks && (
        <div className="rounded-xl border border-white/6 bg-white/2 overflow-hidden">
          <div className="px-3 py-2 border-b border-white/5">
            <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              Setbacks
            </p>
          </div>
          <div className="divide-y divide-white/5">
            {[
              { side: "Front", val: setbacks.front_m },
              { side: "Rear",  val: setbacks.rear_m  },
              { side: "Side",  val: setbacks.side_m  },
            ].map(({ side, val }) => (
              <div key={side} className="flex justify-between items-center px-3 py-2">
                <span className="text-xs text-white/45">{side}</span>
                <span className="text-xs font-semibold text-white">{val} m</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Parking */}
      {cfg?.parking_type && (
        <div className="flex items-center gap-2 rounded-xl bg-[#7F77DD]/8 border
                        border-[#7F77DD]/20 px-3 py-2.5">
          <Building2 size={13} className="text-[#7F77DD] shrink-0" />
          <span className="text-xs text-white/70">{parkingLabel(cfg.parking_type)}</span>
        </div>
      )}

      {/* Warnings */}
      <AnimatePresence>
        {report.warnings.length > 0 && (
          <div className="space-y-2">
            {report.warnings.map((w, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-2 items-start rounded-xl border border-amber-500/20
                           bg-amber-500/6 px-3 py-2.5"
              >
                <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-300/80 leading-relaxed">{w}</p>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Nearby advantages */}
      {nearby.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-white/35 uppercase tracking-wider px-0.5">
            Nearby advantages
          </p>
          <div className="flex flex-wrap gap-1.5">
            {nearby.map((adv, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] font-medium
                           text-emerald-300 bg-emerald-500/8 border border-emerald-500/20
                           rounded-full px-2.5 py-1"
              >
                <MapPin size={9} />
                {adv}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Regulatory notes */}
      {notes && (
        <p className="text-[11px] text-white/30 leading-relaxed border-t border-white/5 pt-3">
          {notes}
        </p>
      )}
    </div>
  );
}
