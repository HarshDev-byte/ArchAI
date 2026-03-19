"use client"

import { useNewProjectStore } from "@/store/new-project"
import type { ProjectType } from "@/types/database"
import type { ProjectStyle, BudgetTier, TargetBuyer } from "@/store/new-project"
import { cn } from "@/lib/utils"
import { Sparkles, Minus, Plus } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Data constants
// ─────────────────────────────────────────────────────────────

const PROJECT_TYPES: { value: ProjectType; label: string; icon: string; desc: string }[] = [
  { value: "apartment",  label: "Apartment",  icon: "🏢", desc: "Multi-unit stacked housing" },
  { value: "bungalow",   label: "Bungalow",   icon: "🏡", desc: "Single-family ground floor" },
  { value: "villa",      label: "Villa",      icon: "🏰", desc: "Luxury standalone homes" },
  { value: "mixed_use",  label: "Mixed Use",  icon: "🏪", desc: "Retail + residential combo" },
  { value: "township",   label: "Township",   icon: "🌆", desc: "Large integrated community" },
]

const STYLES: { value: ProjectStyle; label: string; icon: string; desc: string }[] = [
  { value: "modern",        label: "Modern",        icon: "⬛", desc: "Flat lines, glass, steel" },
  { value: "contemporary",  label: "Contemporary",  icon: "🔷", desc: "Current trends, eclectic" },
  { value: "traditional",   label: "Traditional",   icon: "🏛",  desc: "Classic Indian vernacular" },
  { value: "luxury",        label: "Luxury",        icon: "💎", desc: "High-end finishes throughout" },
]

const BUDGETS: { value: BudgetTier; label: string; icon: string; range: string }[] = [
  { value: "budget",        label: "Budget",       icon: "💰", range: "< ₹4,000/sqft" },
  { value: "mid_range",     label: "Mid Range",    icon: "💳", range: "₹4,000–7,000/sqft" },
  { value: "premium",       label: "Premium",      icon: "✨", range: "₹7,000–12,000/sqft" },
  { value: "ultra_luxury",  label: "Ultra Luxury", icon: "👑", range: "> ₹12,000/sqft" },
]

const BUYERS: { value: TargetBuyer; label: string; icon: string; desc: string }[] = [
  { value: "end_user",   label: "End User",   icon: "🏠", desc: "Owner-occupied" },
  { value: "investor",   label: "Investor",   icon: "📈", desc: "Rental yield focused" },
  { value: "both",       label: "Both",       icon: "🤝", desc: "Mixed demand" },
]

const TYPE_LABELS: Record<ProjectType, string> = {
  apartment: "Apartment",
  bungalow:  "Bungalow",
  villa:     "Villa",
  mixed_use: "Mixed Use",
  township:  "Township",
}

// ─────────────────────────────────────────────────────────────
// Reusable RadioCard
// ─────────────────────────────────────────────────────────────

interface RadioCardProps {
  selected: boolean
  onClick: () => void
  icon: string
  label: string
  sub?: string
  compact?: boolean
  className?: string
}

function RadioCard({ selected, onClick, icon, label, sub, compact, className }: RadioCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col rounded-xl border px-3 transition-all duration-150 text-left",
        compact ? "py-2.5 gap-0.5" : "py-3 gap-1",
        selected
          ? "border-[#7F77DD] bg-[#7F77DD]/12 text-[#7F77DD] shadow-[0_0_12px_#7F77DD20]"
          : "border-white/10 bg-white/3 text-white/60 hover:border-white/20 hover:bg-white/5 hover:text-white",
        className
      )}
    >
      {selected && (
        <div className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#7F77DD]" aria-hidden />
      )}
      <span className={compact ? "text-base" : "text-xl"}>{icon}</span>
      <span className={cn("font-semibold leading-tight", compact ? "text-xs" : "text-sm")}>
        {label}
      </span>
      {sub && (
        <span className={cn("leading-tight", compact ? "text-[10px]" : "text-xs", selected ? "text-[#7F77DD]/70" : "text-white/35")}>
          {sub}
        </span>
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-2">
      {children}
    </p>
  )
}

// ─────────────────────────────────────────────────────────────
// ProjectDetailsForm
// ─────────────────────────────────────────────────────────────

export function ProjectDetailsForm() {
  const {
    projectName, projectType, floorsRequested,
    projectStyle, budgetTier, targetBuyer,
    setProjectName, setProjectType, setFloorsRequested,
    setProjectStyle, setBudgetTier, setTargetBuyer,
    plot,
  } = useNewProjectStore()

  // ── Auto-suggest name ───────────────────────────────────────
  function handleAutoSuggest() {
    const city = plot.locationCity ?? plot.locality?.split(",")[0] ?? "City"
    const type = projectType ? TYPE_LABELS[projectType] : "Project"
    const year = new Date().getFullYear()
    setProjectName(`${city} ${type} ${year}`)
  }

  // ── Floors track fill % ─────────────────────────────────────
  const floorPct = ((floorsRequested - 1) / 39) * 100

  return (
    <div className="space-y-7 max-w-2xl mx-auto">

      {/* ── Project name ── */}
      <div>
        <SectionLabel>Project name *</SectionLabel>
        <div className="flex gap-2">
          <input
            id="step2-project-name"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder='e.g. "Andheri West Apartment 2026"'
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/60 transition-all"
          />
          <button
            type="button"
            title="Auto-suggest name from location and type"
            onClick={handleAutoSuggest}
            className="flex items-center gap-1.5 rounded-xl border border-[#7F77DD]/30 bg-[#7F77DD]/10 px-3 py-2.5 text-xs font-medium text-[#7F77DD] hover:bg-[#7F77DD]/20 transition-colors shrink-0"
          >
            <Sparkles size={13} />
            Auto
          </button>
        </div>
        {projectName.trim().length > 0 && projectName.trim().length < 2 && (
          <p className="text-xs text-red-400 mt-1">Name must be at least 2 characters</p>
        )}
      </div>

      {/* ── Project type ── */}
      <div>
        <SectionLabel>Project type *</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PROJECT_TYPES.map((t) => (
            <RadioCard
              key={t.value}
              selected={projectType === t.value}
              onClick={() => setProjectType(t.value)}
              icon={t.icon}
              label={t.label}
              sub={t.desc}
            />
          ))}
        </div>
      </div>

      {/* ── Number of floors ── */}
      <div>
        {/* Slider style tag */}
        <style>{`
          .floor-slider{-webkit-appearance:none;appearance:none;height:6px;border-radius:6px;outline:none;cursor:pointer;width:100%;}
          .floor-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:22px;height:22px;border-radius:50%;background:#7F77DD;cursor:pointer;border:2px solid #fff;box-shadow:0 0 10px #7F77DD60;}
          .floor-slider::-moz-range-thumb{width:22px;height:22px;border-radius:50%;background:#7F77DD;cursor:pointer;border:2px solid #fff;box-shadow:0 0 10px #7F77DD60;}
        `}</style>

        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Number of floors</SectionLabel>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFloorsRequested(Math.max(1, floorsRequested - 1))}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Minus size={11} />
            </button>
            <span className="w-12 text-center text-base font-bold tabular-nums text-white">
              {floorsRequested}
            </span>
            <button
              type="button"
              onClick={() => setFloorsRequested(Math.min(40, floorsRequested + 1))}
              className="flex h-6 w-6 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <Plus size={11} />
            </button>
          </div>
        </div>

        <input
          id="step2-floors"
          type="range"
          min={1}
          max={40}
          value={floorsRequested}
          onChange={(e) => setFloorsRequested(Number(e.target.value))}
          className="floor-slider"
          style={{
            background: `linear-gradient(to right, #7F77DD ${floorPct}%, rgba(255,255,255,0.1) ${floorPct}%)`,
          }}
        />
        <div className="flex justify-between text-[10px] text-white/25 mt-1">
          <span>1 floor</span>
          <span>40 floors</span>
        </div>
      </div>

      {/* ── Style ── */}
      <div>
        <SectionLabel>Architectural style</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STYLES.map((s) => (
            <RadioCard
              key={s.value}
              selected={projectStyle === s.value}
              onClick={() => setProjectStyle(projectStyle === s.value ? null : s.value)}
              icon={s.icon}
              label={s.label}
              sub={s.desc}
              compact
            />
          ))}
        </div>
      </div>

      {/* ── Budget ── */}
      <div>
        <SectionLabel>Budget tier</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {BUDGETS.map((b) => (
            <RadioCard
              key={b.value}
              selected={budgetTier === b.value}
              onClick={() => setBudgetTier(budgetTier === b.value ? null : b.value)}
              icon={b.icon}
              label={b.label}
              sub={b.range}
              compact
            />
          ))}
        </div>
      </div>

      {/* ── Target buyer ── */}
      <div>
        <SectionLabel>Target buyer</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {BUYERS.map((b) => (
            <RadioCard
              key={b.value}
              selected={targetBuyer === b.value}
              onClick={() => setTargetBuyer(targetBuyer === b.value ? null : b.value)}
              icon={b.icon}
              label={b.label}
              sub={b.desc}
              compact
            />
          ))}
        </div>
      </div>
    </div>
  )
}
