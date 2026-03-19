"use client"

import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface MetricCardProps {
  label: string
  value: string | number
  sub?: string
  icon: LucideIcon
  iconColor?: string
  trend?: { value: number; label: string }
  className?: string
}

export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor = "#7F77DD",
  trend,
  className,
}: MetricCardProps) {
  const trendUp = trend && trend.value > 0

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/7 bg-white/3 p-5 transition-all duration-200 hover:bg-white/5 hover:border-white/12",
        className
      )}
    >
      {/* Subtle corner glow */}
      <div
        className="pointer-events-none absolute -top-6 -right-6 h-20 w-20 rounded-full blur-2xl opacity-20"
        style={{ background: iconColor }}
        aria-hidden="true"
      />

      {/* Icon */}
      <div
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl"
        style={{ background: `${iconColor}18`, color: iconColor }}
      >
        <Icon size={18} />
      </div>

      {/* Value */}
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tracking-tight text-white tabular-nums">
            {value}
          </p>
          <p className="mt-0.5 text-sm text-white/45">{label}</p>
          {sub && <p className="mt-0.5 text-xs text-white/30">{sub}</p>}
        </div>

        {/* Trend badge */}
        {trend && (
          <span
            className={cn(
              "shrink-0 self-start rounded-full px-2 py-0.5 text-xs font-medium",
              trendUp
                ? "bg-emerald-500/15 text-emerald-400"
                : trend.value < 0
                ? "bg-red-500/15 text-red-400"
                : "bg-white/8 text-white/40"
            )}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value} {trend.label}
          </span>
        )}
      </div>
    </div>
  )
}
