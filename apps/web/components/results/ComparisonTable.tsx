"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { Sparkles, Trophy, TrendingUp, Users, Layers, Building2, ParkingCircle, Maximize2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import type { LayoutRecord, UnitMixItem } from "@/components/results/LayoutSelector";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toCr(inr: number): string {
  return `₹${(inr / 1_00_00_000).toFixed(2)} Cr`;
}

function unitMixShort(mix: UnitMixItem[]): string {
  return mix
    .filter((u) => u.count > 0)
    .map((u) => `${u.count}×${u.type.split(" ")[0]}`)
    .join("  ");
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

function totalAreaSqft(layout: LayoutRecord): number {
  const fp = layout.floor_plan;
  return fp.footprint.width_ft * fp.footprint.depth_ft * fp.floors;
}

// ─────────────────────────────────────────────────────────────
// Row definitions
// ─────────────────────────────────────────────────────────────

interface RowDef {
  key:     string;
  label:   string;
  icon:    React.ReactNode;
  value:   (layout: LayoutRecord) => string | number;
  format:  (v: string | number) => string;
  /** Higher is better? (for green-highlight logic). null = no compare */
  higherBetter: boolean | null;
}

const ROWS: RowDef[] = [
  {
    key:          "units",
    label:        "Total Units",
    icon:         <Users size={12} />,
    value:        (l) => l.total_units,
    format:       (v) => `${v}`,
    higherBetter: true,
  },
  {
    key:          "unit_mix",
    label:        "Unit Mix",
    icon:         <Layers size={12} />,
    value:        (l) => unitMixShort(l.unit_mix),
    format:       (v) => String(v),
    higherBetter: null,
  },
  {
    key:          "total_area",
    label:        "Total Built Area",
    icon:         <Maximize2 size={12} />,
    value:        (l) => totalAreaSqft(l),
    format:       (v) => `${Number(v).toLocaleString("en-IN")} sqft`,
    higherBetter: true,
  },
  {
    key:          "cost",
    label:        "Est. Cost",
    icon:         <Building2 size={12} />,
    value:        (l) => l.construction_cost_inr,
    format:       (v) => toCr(Number(v)),
    higherBetter: false,    // lower cost is better
  },
  {
    key:          "revenue",
    label:        "Est. Revenue",
    icon:         <TrendingUp size={12} />,
    value:        (l) => l.sale_revenue_inr,
    format:       (v) => toCr(Number(v)),
    higherBetter: true,
  },
  {
    key:          "roi",
    label:        "ROI %",
    icon:         <TrendingUp size={12} />,
    value:        (l) => l.roi_pct,
    format:       (v) => `${Number(v).toFixed(1)}%`,
    higherBetter: true,
  },
  {
    key:          "floors",
    label:        "Floors",
    icon:         <Layers size={12} />,
    value:        (l) => l.floor_plan.floors,
    format:       (v) => `${v}`,
    higherBetter: null,
  },
  {
    key:          "footprint",
    label:        "Footprint Shape",
    icon:         <Maximize2 size={12} />,
    value:        (l) => footprintLabel(l.floor_plan.footprint.shape),
    format:       (v) => String(v),
    higherBetter: null,
  },
];

// ─────────────────────────────────────────────────────────────
// Best-value logic: returns Set of layout IDs that "win" a row
// ─────────────────────────────────────────────────────────────

function bestForRow(
  row: RowDef,
  layouts: LayoutRecord[],
): Set<string> {
  if (row.higherBetter === null) return new Set();
  const nums = layouts.map((l) => Number(row.value(l)));
  const target = row.higherBetter ? Math.max(...nums) : Math.min(...nums);
  const winners = new Set<string>();
  layouts.forEach((l, i) => {
    if (nums[i] === target) winners.add(l.id);
  });
  return winners;
}

// Determine overall best-ROI layout
function bestRoiLayout(layouts: LayoutRecord[]): LayoutRecord | null {
  if (layouts.length === 0) return null;
  return [...layouts].sort((a, b) => b.roi_pct - a.roi_pct)[0];
}

// Seed → tier letter
function layoutLetter(index: number): string {
  return ["A", "B", "C", "D"][index] ?? String(index + 1);
}

const SEED_ACCENT: string[] = [
  "#60a5fa",   // blue  — Layout A
  "#7F77DD",   // purple — Layout B
  "#f59e0b",   // amber — Layout C
];

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────

export interface ComparisonTableProps {
  layouts:          LayoutRecord[];
  selectedLayoutId: string | null;
  onSelect:         (id: string) => void;
}

export function ComparisonTable({
  layouts,
  selectedLayoutId,
  onSelect,
}: ComparisonTableProps) {
  const best = bestRoiLayout(layouts);

  const handleAiCompare = useCallback(() => {
    toast("AI comparison coming soon ✨", {
      icon: "🤖",
      style: {
        background: "#1c2030",
        color:      "#e8ecf4",
        border:     "1px solid rgba(127,119,221,0.3)",
        borderRadius: "12px",
        fontSize:   "13px",
      },
      duration: 3000,
    });
  }, []);

  if (layouts.length === 0) {
    return (
      <div className="rounded-2xl border border-white/8 bg-white/2 px-6 py-8 text-center">
        <Layers size={24} className="mx-auto mb-2 text-white/20" />
        <p className="text-sm text-white/40">No layouts to compare yet.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="rounded-2xl border border-white/8 overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="bg-[#111318] border-b border-white/6 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-widest">
            Side-by-Side Comparison
          </h3>
        </div>

        {best && (
          <button
            id="btn-ai-compare"
            onClick={handleAiCompare}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg
                       border border-[#7F77DD]/30 bg-[#7F77DD]/10 text-[#a5b4fc]
                       hover:bg-[#7F77DD]/20 transition-all duration-150"
          >
            <Sparkles size={11} />
            Why is Layout {layoutLetter(layouts.indexOf(best))} best ROI?
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
          {/* Column headers */}
          <thead>
            <tr className="border-b border-white/6 bg-[#0d0f14]">
              {/* Row label column */}
              <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-white/25 uppercase tracking-wider w-36 min-w-[130px]">
                Metric
              </th>

              {layouts.map((layout, idx) => {
                const letter  = layoutLetter(idx);
                const accent  = SEED_ACCENT[idx] ?? "#7F77DD";
                const isSel   = layout.id === selectedLayoutId;
                const isBest  = layout.id === best?.id;

                return (
                  <th
                    key={layout.id}
                    className={cn(
                      "px-3 py-2.5 text-center min-w-[140px] cursor-pointer select-none",
                      "transition-colors duration-150",
                      isSel ? "bg-white/4" : "hover:bg-white/2",
                    )}
                    onClick={() => onSelect(layout.id)}
                  >
                    <div className="flex flex-col items-center gap-1">
                      {/* Letter badge */}
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
                        style={{
                          background: accent + "22",
                          color:      accent,
                          border:     `1.5px solid ${accent}44`,
                          boxShadow:  isSel ? `0 0 10px ${accent}30` : "none",
                        }}
                      >
                        {letter}
                      </div>

                      {/* Concept name */}
                      <span className="text-[11px] font-semibold text-white leading-tight text-center line-clamp-1 max-w-[120px]">
                        {layout.concept_name}
                      </span>

                      {/* Best ROI crown */}
                      {isBest && (
                        <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10
                                         border border-amber-400/20 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Trophy size={8} /> Best ROI
                        </span>
                      )}

                      {/* Selected indicator */}
                      {isSel && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{ background: accent + "22", color: accent }}
                        >
                          Selected
                        </span>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Rows */}
          <tbody>
            {ROWS.map((row, rowIdx) => {
              const winners = bestForRow(row, layouts);
              const isEven  = rowIdx % 2 === 0;

              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b border-white/4 transition-colors",
                    isEven ? "bg-[#0d0f14]" : "bg-[#0a0c11]",
                  )}
                >
                  {/* Metric label */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-white/40">
                      <span className="text-white/25 shrink-0">{row.icon}</span>
                      <span className="font-medium text-[11px] whitespace-nowrap">{row.label}</span>
                    </div>
                  </td>

                  {/* Values */}
                  {layouts.map((layout, idx) => {
                    const val     = row.value(layout);
                    const isWin   = winners.has(layout.id);
                    const isSel   = layout.id === selectedLayoutId;
                    const accent  = SEED_ACCENT[idx] ?? "#7F77DD";

                    return (
                      <td
                        key={layout.id}
                        className="px-3 py-3 text-center"
                        style={{
                          background: isWin
                            ? "rgba(74, 222, 128, 0.07)"
                            : isSel
                            ? "rgba(255,255,255,0.025)"
                            : undefined,
                        }}
                      >
                        <span
                          className={cn(
                            "font-semibold text-[12px] tabular-nums",
                            isWin   ? "text-emerald-300" :
                            isSel   ? "text-white"       : "text-white/55",
                          )}
                        >
                          {row.format(val)}
                        </span>
                        {isWin && (
                          <span className="ml-1 text-emerald-400/80 text-[9px]">▲</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Footer note ── */}
      <div className="bg-[#0a0c11] border-t border-white/5 px-4 py-2.5 flex items-center justify-between">
        <p className="text-[10px] text-white/20">
          <span className="text-emerald-400">▲</span> = best value in row · click column header to select layout
        </p>
        {best && (
          <p className="text-[10px] text-white/25">
            Highest ROI: <span className="text-amber-400 font-semibold">
              {best.roi_pct.toFixed(1)}%
            </span>
          </p>
        )}
      </div>
    </motion.div>
  );
}
