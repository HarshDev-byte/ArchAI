"use client"

import { useNewProjectStore } from "@/store/new-project"
import type { BHKType } from "@/store/new-project"
import { cn } from "@/lib/utils"
import { Plus, Minus, Check } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Unit mix config
// ─────────────────────────────────────────────────────────────

const UNIT_TYPES: { type: BHKType; label: string; icon: string; sqft: string }[] = [
  { type: "studio",    label: "Studio",  icon: "🟦", sqft: "~300–450 sqft" },
  { type: "1bhk",      label: "1 BHK",   icon: "🟩", sqft: "~450–650 sqft" },
  { type: "2bhk",      label: "2 BHK",   icon: "🟨", sqft: "~700–1,000 sqft" },
  { type: "3bhk",      label: "3 BHK",   icon: "🟧", sqft: "~1,000–1,400 sqft" },
  { type: "4bhk_plus", label: "4 BHK+",  icon: "🟥", sqft: "> 1,400 sqft" },
]

// ─────────────────────────────────────────────────────────────
// Amenities config
// ─────────────────────────────────────────────────────────────

const AMENITY_GROUPS = [
  {
    label: "Parking",
    items: [
      { id: "podium_parking",   label: "Podium Parking",   icon: "🚗" },
      { id: "basement_parking", label: "Basement Parking", icon: "🅿️" },
      { id: "surface_parking",  label: "Surface Parking",  icon: "🏎️" },
      { id: "ev_charging",      label: "EV Charging",      icon: "⚡" },
    ],
  },
  {
    label: "Lifestyle",
    items: [
      { id: "swimming_pool",    label: "Swimming Pool",    icon: "🏊" },
      { id: "gym",              label: "Gym",              icon: "💪" },
      { id: "clubhouse",        label: "Clubhouse",        icon: "🏛️" },
      { id: "rooftop_terrace",  label: "Rooftop Terrace",  icon: "🌆" },
    ],
  },
  {
    label: "Outdoor & Green",
    items: [
      { id: "childrens_play",   label: "Children's Play",  icon: "🛝" },
      { id: "garden",           label: "Garden",           icon: "🌿" },
      { id: "solar_panels",     label: "Solar Panels",     icon: "☀️" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { id: "retail_shops",     label: "Retail Shops",     icon: "🏪" },
    ],
  },
]

// Flat list for lookup
const ALL_AMENITIES = AMENITY_GROUPS.flatMap((g) => g.items)

// ─────────────────────────────────────────────────────────────
// UnitMixRow
// ─────────────────────────────────────────────────────────────

function UnitMixRow({ type, label, icon, sqft }: (typeof UNIT_TYPES)[number]) {
  const { unitMix, toggleUnitType, setUnitCount } = useNewProjectStore()
  const entry = unitMix.find((u) => u.type === type)!
  const { enabled, count } = entry

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150",
        enabled
          ? "border-[#7F77DD]/35 bg-[#7F77DD]/8"
          : "border-white/8 bg-white/3 hover:border-white/15"
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        id={`unit-${type}`}
        onClick={() => toggleUnitType(type)}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all",
          enabled
            ? "border-[#7F77DD] bg-[#7F77DD]"
            : "border-white/25 bg-transparent hover:border-white/50"
        )}
        aria-pressed={enabled}
        aria-label={`Toggle ${label}`}
      >
        {enabled && <Check size={11} strokeWidth={3} className="text-white" />}
      </button>

      {/* Icon + label */}
      <span className="text-base shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-semibold", enabled ? "text-white" : "text-white/55")}>
          {label}
        </p>
        <p className="text-xs text-white/30">{sqft}</p>
      </div>

      {/* Count stepper — visible only when enabled */}
      <div
        className={cn(
          "flex items-center gap-1.5 transition-all duration-200",
          enabled ? "opacity-100 translate-x-0" : "opacity-0 pointer-events-none translate-x-2"
        )}
      >
        <button
          type="button"
          onClick={() => setUnitCount(type, Math.max(0, count - 1))}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          aria-label={`Decrease ${label} count`}
        >
          <Minus size={11} />
        </button>
        <span className="w-8 text-center text-sm font-bold tabular-nums text-white">
          {count}
        </span>
        <button
          type="button"
          onClick={() => setUnitCount(type, count + 1)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          aria-label={`Increase ${label} count`}
        >
          <Plus size={11} />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// AmenityChip
// ─────────────────────────────────────────────────────────────

function AmenityChip({ id, label, icon }: { id: string; label: string; icon: string }) {
  const { amenities, toggleAmenity } = useNewProjectStore()
  const selected = amenities.includes(id)

  return (
    <button
      type="button"
      id={`amenity-${id}`}
      onClick={() => toggleAmenity(id)}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all duration-150",
        selected
          ? "border-[#7F77DD]/40 bg-[#7F77DD]/12 text-[#7F77DD]"
          : "border-white/8 bg-white/3 text-white/55 hover:border-white/18 hover:bg-white/5 hover:text-white"
      )}
    >
      <span className="text-base leading-none">{icon}</span>
      <span className="leading-tight text-xs">{label}</span>
      {selected && (
        <Check size={10} strokeWidth={3} className="ml-auto shrink-0 text-[#7F77DD]" />
      )}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────
// Section header
// ─────────────────────────────────────────────────────────────

function SectionLabel({
  children,
  right,
}: {
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/35">
        {children}
      </p>
      {right && <span className="text-xs text-white/30">{right}</span>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// RequirementsForm
// ─────────────────────────────────────────────────────────────

export function RequirementsForm() {
  const { amenities, specialNotes, unitMix, setSpecialNotes } = useNewProjectStore()

  const totalUnits = unitMix.filter((u) => u.enabled).reduce((a, u) => a + u.count, 0)
  const selectedAmenityCount = amenities.length
  const notesLeft = 300 - specialNotes.length

  return (
    <div className="space-y-7 max-w-2xl mx-auto">

      {/* ── Unit Mix ── */}
      <div>
        <SectionLabel
          right={totalUnits > 0 ? `${totalUnits} unit${totalUnits !== 1 ? "s" : ""} total` : undefined}
        >
          Unit mix
        </SectionLabel>

        <div className="space-y-2">
          {UNIT_TYPES.map((u) => (
            <UnitMixRow key={u.type} {...u} />
          ))}
        </div>

        {totalUnits === 0 && (
          <p className="text-xs text-white/30 mt-2 pl-1">
            Select at least one unit type — or leave blank to let AI suggest the optimal mix.
          </p>
        )}
      </div>

      {/* ── Amenities ── */}
      <div>
        <SectionLabel
          right={
            selectedAmenityCount > 0
              ? `${selectedAmenityCount} selected`
              : undefined
          }
        >
          Amenities &amp; facilities
        </SectionLabel>

        <div className="space-y-4">
          {AMENITY_GROUPS.map((group) => (
            <div key={group.label}>
              <p className="text-[10px] font-medium uppercase tracking-wider text-white/25 mb-2">
                {group.label}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {group.items.map((item) => (
                  <AmenityChip key={item.id} {...item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Special notes ── */}
      <div>
        <SectionLabel right={`${notesLeft} left`}>
          Special notes &amp; constraints
        </SectionLabel>

        <textarea
          id="step3-notes"
          rows={4}
          maxLength={300}
          value={specialNotes}
          onChange={(e) => setSpecialNotes(e.target.value)}
          placeholder="Any specific requirements, site constraints, legal restrictions, design vision, or client preferences that the AI should consider…"
          className={cn(
            "w-full resize-none rounded-xl border bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 transition-colors",
            notesLeft < 30
              ? "border-orange-400/40 focus:ring-orange-400/40"
              : "border-white/10 focus:ring-[#7F77DD]/60"
          )}
        />

        {/* Example hints */}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "Retain existing boundary wall",
            "Vastu compliant",
            "No cut-off corners",
            "Corner plot",
          ].map((hint) => (
            <button
              type="button"
              key={hint}
              onClick={() =>
                setSpecialNotes(
                  specialNotes
                    ? `${specialNotes}, ${hint.toLowerCase()}`
                    : hint
                )
              }
              className="rounded-full border border-white/8 bg-white/4 px-2.5 py-1 text-[10px] text-white/40 hover:border-white/20 hover:text-white/70 transition-colors"
            >
              + {hint}
            </button>
          ))}
        </div>
      </div>

      {/* ── Summary chip ── */}
      {(totalUnits > 0 || selectedAmenityCount > 0) && (
        <div className="rounded-xl border border-[#7F77DD]/20 bg-[#7F77DD]/6 px-4 py-3">
          <p className="text-xs font-medium text-[#7F77DD]/80 mb-1">Summary</p>
          <p className="text-xs text-white/55 leading-relaxed">
            {totalUnits > 0 && (
              <>
                <span className="text-white font-medium">{totalUnits} units</span>
                {" "}across{" "}
                <span className="text-white font-medium">
                  {unitMix.filter((u) => u.enabled).map((u) => u.type.toUpperCase()).join(", ")}
                </span>
              </>
            )}
            {totalUnits > 0 && selectedAmenityCount > 0 && " · "}
            {selectedAmenityCount > 0 && (
              <>
                <span className="text-white font-medium">{selectedAmenityCount}</span>
                {" amenities"}
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
