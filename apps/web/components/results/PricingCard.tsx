"use client";

import { motion } from "framer-motion";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";
import { Lock, TrendingUp, IndianRupee, Percent, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LayoutRecord } from "@/components/results/LayoutSelector";

// ─────────────────────────────────────────────────────────────
// Cost breakdown slices (percentages of construction cost)
// ─────────────────────────────────────────────────────────────

const COST_SLICES = [
  { name: "Structure",   pct: 35, color: "#7F77DD" },
  { name: "Finishing",   pct: 28, color: "#60a5fa" },
  { name: "Foundation",  pct: 15, color: "#a78bfa" },
  { name: "MEP",         pct: 12, color: "#34d399" },
  { name: "Misc",        pct: 10, color: "#f59e0b" },
];

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function toCr(inr: number): string {
  return `₹${(inr / 1_00_00_000).toFixed(2)} Cr`;
}

function toLakh(inr: number): string {
  return `₹${(inr / 1_00_000).toFixed(1)} L`;
}

/** Approx city sale rate per sqft (INR) — used as a cross-check display */
const CITY_RATE_PER_SQFT = 8_500; // ₹ 8,500 / sqft baseline

// ─────────────────────────────────────────────────────────────
// Custom Tooltip
// ─────────────────────────────────────────────────────────────

interface TooltipPayload {
  name:  string;
  value: number;
  payload: {
    color: string;
    absoluteInr: number;
  };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-xl border border-white/15 bg-[#1c2030] px-3 py-2 shadow-xl text-xs">
      <p className="font-bold text-white mb-0.5">{p.name}</p>
      <p style={{ color: p.payload.color }} className="font-semibold">
        {p.value}% of cost
      </p>
      <p className="text-white/40 mt-0.5 text-[11px]">
        {toCr(p.payload.absoluteInr)}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Custom legend
// ─────────────────────────────────────────────────────────────

function BreakdownLegend({
  slices,
  totalCostInr,
}: {
  slices: typeof COST_SLICES;
  totalCostInr: number;
}) {
  return (
    <div className="space-y-1.5">
      {slices.map((s) => {
        const absInr = (s.pct / 100) * totalCostInr;
        return (
          <div key={s.name} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: s.color }}
              />
              <span className="text-[11px] text-white/55">{s.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-white/80 tabular-nums">
                {toCr(absInr)}
              </span>
              <span
                className="text-[10px] font-bold tabular-nums w-8 text-right"
                style={{ color: s.color }}
              >
                {s.pct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Financial summary row
// ─────────────────────────────────────────────────────────────

interface SummaryRowProps {
  label:    string;
  value:    string;
  icon:     React.ReactNode;
  accent?:  string;
  sub?:     string;
}

function SummaryRow({ label, value, icon, accent = "white", sub }: SummaryRowProps) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2">
        <span style={{ color: accent }}>{icon}</span>
        <div>
          <p className="text-[11px] text-white/45">{label}</p>
          {sub && <p className="text-[9px] text-white/25 mt-0.5">{sub}</p>}
        </div>
      </div>
      <p
        className="text-sm font-bold tabular-nums"
        style={{ color: accent === "white" ? "#e8ecf4" : accent }}
      >
        {value}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────

export interface PricingCardProps {
  layout: LayoutRecord | null;
}

export function PricingCard({ layout }: PricingCardProps) {
  if (!layout) {
    return (
      <div className="rounded-2xl border border-dashed border-white/8 bg-white/1.5 px-6 py-8 text-center">
        <BarChart2 size={24} className="mx-auto mb-2 text-white/15" />
        <p className="text-sm text-white/30">Select a layout to see pricing breakdown</p>
      </div>
    );
  }

  const cost     = layout.construction_cost_inr;
  const revenue  = layout.sale_revenue_inr;
  const profit   = revenue - cost;
  const margin   = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Build absolute values for each slice
  const pieData = COST_SLICES.map((s) => ({
    ...s,
    value:       s.pct,
    absoluteInr: (s.pct / 100) * cost,
  }));

  // Cost per unit
  const costPerUnit  = layout.total_units > 0 ? cost / layout.total_units  : 0;
  const revenuePerUnit = layout.total_units > 0 ? revenue / layout.total_units : 0;

  return (
    <motion.div
      key={layout.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-white/8 overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="bg-[#111318] border-b border-white/6 px-4 py-3 flex items-center gap-2">
        <BarChart2 size={14} className="text-[#7F77DD]" />
        <h3 className="text-xs font-bold text-white uppercase tracking-widest">
          Pricing Breakdown
        </h3>
        <span className="ml-auto text-[10px] text-white/30 truncate max-w-[140px]">
          {layout.concept_name}
        </span>
      </div>

      <div className="bg-[#0d0f14] p-4 space-y-5">

        {/* ── Pie chart + legend ── */}
        <div className="flex gap-4 items-center">
          {/* Pie */}
          <div className="w-[130px] h-[130px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={34}
                  outerRadius={58}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={450}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
              Construction Cost Split
            </p>
            <BreakdownLegend slices={COST_SLICES} totalCostInr={cost} />
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-t border-white/6" />

        {/* ── Financial summary ── */}
        <div>
          <p className="text-[10px] font-semibold text-white/30 uppercase tracking-wider mb-2">
            Project Financials
          </p>
          <div className="rounded-xl border border-white/6 bg-white/2 px-3 divide-y divide-white/5">
            <SummaryRow
              label="Total Construction Cost"
              value={toCr(cost)}
              icon={<IndianRupee size={12} />}
              accent="#f87171"
              sub={`${toLakh(costPerUnit)} per unit`}
            />
            <SummaryRow
              label="Estimated Revenue"
              value={toCr(revenue)}
              icon={<TrendingUp size={12} />}
              accent="#34d399"
              sub={`${toLakh(revenuePerUnit)} per unit · ₹${CITY_RATE_PER_SQFT.toLocaleString()} /sqft baseline`}
            />
            <SummaryRow
              label="Gross Profit"
              value={toCr(profit)}
              icon={<IndianRupee size={12} />}
              accent={profit >= 0 ? "#34d399" : "#f87171"}
            />
            <SummaryRow
              label="Profit Margin"
              value={`${margin.toFixed(1)}%`}
              icon={<Percent size={12} />}
              accent={margin >= 20 ? "#34d399" : margin >= 10 ? "#f59e0b" : "#f87171"}
              sub={
                margin >= 25 ? "Excellent margin" :
                margin >= 15 ? "Good margin" :
                margin >= 5  ? "Thin margin" : "Loss-making"
              }
            />
          </div>
        </div>

        {/* ── ROI callout ── */}
        <div
          className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{
            background:   layout.roi_pct >= 0 ? "rgba(52, 211, 153, 0.06)" : "rgba(248, 113, 113, 0.06)",
            border:       `1px solid ${layout.roi_pct >= 0 ? "rgba(52,211,153,0.2)" : "rgba(248,113,113,0.2)"}`,
          }}
        >
          <div>
            <p className="text-[10px] text-white/35 mb-0.5">Return on Investment</p>
            <p
              className="text-2xl font-black tabular-nums"
              style={{ color: layout.roi_pct >= 0 ? "#34d399" : "#f87171" }}
            >
              {layout.roi_pct.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/25">Based on</p>
            <p className="text-[11px] text-white/50 font-medium">
              {layout.total_units} units
            </p>
            <p className="text-[11px] text-white/50 font-medium">
              {layout.floor_plan.floors} floors
            </p>
          </div>
        </div>

        {/* ── Phase 2 CTA ── */}
        <button
          disabled
          id="btn-detailed-financial"
          className={cn(
            "w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold",
            "border border-white/8 bg-white/2 text-white/25 cursor-not-allowed",
          )}
        >
          <Lock size={12} />
          Get Detailed Financial Model
          <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-white/6 text-white/30">
            Phase 2
          </span>
        </button>
      </div>
    </motion.div>
  );
}
