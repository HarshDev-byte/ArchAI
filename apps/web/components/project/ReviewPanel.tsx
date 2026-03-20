"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useNewProjectStore } from "@/store/new-project"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  AlertCircle, RefreshCw, Zap, Clock, CheckCircle2,
  Loader2, ArrowUpRight, MapPin,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Feature, Polygon } from "geojson"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

function wsBaseUrl(api: string) { return api.replace(/^http/, "ws") }

// ─────────────────────────────────────────────────────────────
// Progress stages
// ─────────────────────────────────────────────────────────────
const STAGES = [
  { id: "creating",    label: "Creating project",           icon: "\ud83d\udcbe", pct: 10  },
  { id: "analysing",   label: "Analysing plot dimensions",  icon: "\ud83d\udcd0", pct: 30  },
  { id: "regulations", label: "Checking local regulations", icon: "\ud83d\udccb", pct: 55  },
  { id: "claude",      label: "Generating AI feasibility",  icon: "\ud83e\udde0", pct: 80  },
  { id: "layouts",     label: "Creating 3 layout configs",  icon: "\ud83c\udfd7\ufe0f", pct: 100 },
]

type GenPhase = "idle" | "generating" | "error"

// ─────────────────────────────────────────────────────────────
// Thumbnail builder
// ─────────────────────────────────────────────────────────────
function buildThumbnailUrl(geojson: Feature<Polygon> | null, lat: number | null, lng: number | null, token: string) {
  const SIZE = "600x260"
  if (geojson && token) {
    const styled = {
      type: "Feature",
      properties: { stroke: "#7F77DD", "stroke-width": 3, fill: "#7F77DD", "fill-opacity": 0.28 },
      geometry: geojson.geometry,
    }
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/geojson(${encodeURIComponent(JSON.stringify(styled))})/auto/${SIZE}?access_token=${token}&padding=30`
    if (url.length <= 8192) return url
  }
  if (lat && lng && token) return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},17/${SIZE}?access_token=${token}`
  return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/72.8777,19.076,13/${SIZE}?access_token=${token}`
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const f = (v: number | null | undefined, d = 0) => v == null ? "—" : v.toFixed(d)
const tc = (s: string | null | undefined) => s ? s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) : "—"
const BHK: Record<string, string> = { studio: "Studio", "1bhk": "1 BHK", "2bhk": "2 BHK", "3bhk": "3 BHK", "4bhk_plus": "4 BHK+" }

// ─────────────────────────────────────────────────────────────
// Summary card
// ─────────────────────────────────────────────────────────────
function SummaryCard({ title, icon, rows }: { title: string; icon: string; rows: [string, string][] }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/6">
        <span className="text-sm">{icon}</span>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">{title}</p>
      </div>
      <div className="divide-y divide-white/5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between px-4 py-2.5 gap-4">
            <span className="text-xs text-white/35 shrink-0">{label}</span>
            <span className="text-xs font-medium text-white text-right leading-relaxed">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Progress overlay
// ─────────────────────────────────────────────────────────────
function ProgressOverlay({ stageId, pct, message, seconds }: { stageId: string; pct: number; message: string; seconds: number }) {
  const curIdx = STAGES.findIndex(s => s.id === stageId)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#090a0f]/93 backdrop-blur-md rounded-2xl px-6 py-8">

      {/* Orbital spinner */}
      <div className="relative mb-7 h-20 w-20 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-[#7F77DD]/15 animate-ping" />
        <div className="absolute inset-0 rounded-full border border-[#7F77DD]/25" />
        <motion.div className="absolute inset-2 rounded-full border-2 border-t-[#7F77DD] border-r-[#7F77DD]/40 border-b-transparent border-l-transparent"
          animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: "linear" }} />
        <span className="text-xl">{STAGES[Math.max(0, curIdx)]?.icon ?? "\ud83e\udde0"}</span>
      </div>

      <p className="text-base font-semibold text-white mb-1">Generating your report…</p>
      <p className="text-sm text-white/45 mb-6 text-center max-w-xs leading-relaxed">{message}</p>

      {/* Progress bar */}
      <div className="w-full max-w-xs mb-5">
        <div className="flex justify-between mb-1.5 text-xs">
          <span className="text-white/35">Progress</span>
          <span className="font-semibold text-white tabular-nums">{Math.round(pct)}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/8 overflow-hidden">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#5b53b8] to-[#7F77DD]"
            animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }} />
        </div>
      </div>

      {/* Stage list */}
      <div className="w-full max-w-xs space-y-2 mb-5">
        {STAGES.map((stage, idx) => {
          const done = idx < curIdx, cur = idx === curIdx, pend = idx > curIdx
          return (
            <div key={stage.id} className={cn("flex items-center gap-3 transition-opacity", pend && "opacity-30")}>
              <div className="h-6 w-6 flex items-center justify-center shrink-0">
                {done && <CheckCircle2 size={15} className="text-emerald-400" />}
                {cur  && <Loader2 size={15} className="text-[#7F77DD] animate-spin" />}
                {pend && <div className="h-3.5 w-3.5 rounded-full border border-white/20" />}
              </div>
              <p className={cn("text-xs font-medium", cur ? "text-white" : done ? "text-white/55" : "text-white/30")}>
                {stage.label}
              </p>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-white/30">
        <Clock size={11} /><span>~{Math.max(0, seconds)}s remaining</span>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// Error card
// ─────────────────────────────────────────────────────────────
function ErrorCard({ message, onRetry, onEdit }: { message: string; onRetry: () => void; onEdit: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center px-6 py-10 space-y-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/12 border border-red-500/20">
        <AlertCircle size={24} className="text-red-400" />
      </div>
      <div>
        <p className="text-base font-semibold text-white mb-1">Generation failed</p>
        <p className="text-sm text-white/50 leading-relaxed max-w-xs">{message}</p>
      </div>
      <div className="flex gap-3 pt-1">
        <Button variant="outline" onClick={onEdit}>Edit inputs</Button>
        <Button onClick={onRetry} className="gap-1.5"><RefreshCw size={13} />Try again</Button>
      </div>
    </motion.div>
  )
}

// ─────────────────────────────────────────────────────────────
// ReviewPanel
// ─────────────────────────────────────────────────────────────
export function ReviewPanel() {
  const router = useRouter()
  const {
    plot, projectName, projectType, floorsRequested,
    projectStyle, budgetTier, targetBuyer,
    unitMix, amenities, specialNotes, setStep,
  } = useNewProjectStore()

  const [phase, setPhase]       = useState<GenPhase>("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [stageId, setStageId]   = useState("creating")
  const [pct, setPct]           = useState(0)
  const [wsMsg, setWsMsg]       = useState("")
  const [secs, setSecs]         = useState(25)
  const wsRef    = useRef<WebSocket | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    wsRef.current?.close()
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const thumbnailUrl = useMemo(() =>
    buildThumbnailUrl(plot.plotGeoJSON, plot.locationLat, plot.locationLng, MAPBOX_TOKEN),
    [plot.plotGeoJSON, plot.locationLat, plot.locationLng])

  const enabledUnits = unitMix.filter(u => u.enabled && u.count > 0)
  const totalUnits   = enabledUnits.reduce((a, u) => a + u.count, 0)

  const handleGenerate = useCallback(async () => {
    setPhase("generating"); setErrorMsg(""); setPct(5); setStageId("creating"); setWsMsg("Saving inputs…"); setSecs(25)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setSecs(s => Math.max(0, s - 1)), 1000)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error("Not authenticated. Please sign in again.")
      const headers: HeadersInit = { "Content-Type": "application/json", Authorization: `Bearer ${token}` }

      // 1. Create project
      const projRes = await fetch(`${API_URL}/api/v1/projects`, {
        method: "POST", headers,
        body: JSON.stringify({
          name: projectName, project_type: projectType,
          plot_geojson: plot.plotGeoJSON, plot_area_sqft: plot.plotAreaSqft,
          plot_length_ft: plot.plotLengthFt, plot_width_ft: plot.plotWidthFt,
          location_city: plot.locationCity, location_state: plot.locationState,
          location_lat: plot.locationLat, location_lng: plot.locationLng,
          floors_requested: floorsRequested,
          requirements: {
            style: projectStyle, budget_tier: budgetTier, target_buyer: targetBuyer,
            unit_mix: unitMix.filter(u => u.enabled), amenities,
            special_notes: specialNotes, nearby_context: plot.nearbyContext,
          },
        }),
      })
      if (!projRes.ok) {
        const e = await projRes.json().catch(() => ({})) as { detail?: string }
        throw new Error(e.detail ?? `HTTP ${projRes.status}`)
      }
      const { id: projectId } = await projRes.json() as { id: string }
      setPct(10)

      // 2. Trigger feasibility
      setStageId("analysing"); setWsMsg("Starting AI analysis…")
      const feasRes = await fetch(`${API_URL}/api/v1/feasibility/check`, {
        method: "POST", headers, body: JSON.stringify({ project_id: projectId }),
      })
      if (!feasRes.ok) {
        const e = await feasRes.json().catch(() => ({})) as { detail?: string }
        throw new Error(e.detail ?? `HTTP ${feasRes.status}`)
      }
      const { job_id: jobId } = await feasRes.json() as { job_id: string }

      // 3. WebSocket stream
      const ws = new WebSocket(`${wsBaseUrl(API_URL)}/ws/${jobId}`)
      wsRef.current = ws

      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data as string) as { type: string; stage?: string; message?: string; pct?: number; project_id?: string }
        if (msg.type === "progress") {
          if (msg.stage)   setStageId(msg.stage)
          if (msg.message) setWsMsg(msg.message)
          if (msg.pct != null) setPct(msg.pct)
        }
        if (msg.type === "complete") {
          setPct(100); if (timerRef.current) clearInterval(timerRef.current)
          setTimeout(() => router.push(`/dashboard/projects/${msg.project_id ?? projectId}/results`), 600)
        }
        if (msg.type === "error") { setErrorMsg(msg.message ?? "AI error"); setPhase("error"); if (timerRef.current) clearInterval(timerRef.current) }
      }
      ws.onerror = () => { setErrorMsg("Lost connection to server."); setPhase("error"); if (timerRef.current) clearInterval(timerRef.current) }
    } catch (err) {
      setErrorMsg((err as Error).message); setPhase("error"); if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [plot, projectName, projectType, floorsRequested, projectStyle, budgetTier, targetBuyer, unitMix, amenities, specialNotes, router])

  const plotRows: [string, string][] = [
    ["Area",       plot.plotAreaSqft ? `${f(plot.plotAreaSqft)} sqft · ${f(plot.plotAreaCents, 2)} cents` : "—"],
    ["Dimensions", plot.plotLengthFt ? `${f(plot.plotLengthFt)} × ${f(plot.plotWidthFt)} ft` : "—"],
    ["Location",   [plot.locality?.split(",")[0], plot.locationCity].filter(Boolean).join(", ") || "—"],
    ["Nearby",     plot.nearbyContext ?? "—"],
  ]
  const projectRows: [string, string][] = [
    ["Name", projectName || "—"], ["Type", tc(projectType)], ["Floors", `${floorsRequested}`],
    ["Style", tc(projectStyle) || "AI suggested"], ["Budget", tc(budgetTier) || "AI suggested"],
    ["For", tc(targetBuyer) || "—"],
  ]

  return (
    <div className="relative max-w-2xl mx-auto">
      <AnimatePresence>
        {phase === "generating" && <ProgressOverlay stageId={stageId} pct={pct} message={wsMsg} seconds={secs} />}
      </AnimatePresence>

      {phase === "error" && <ErrorCard message={errorMsg} onRetry={() => { setPhase("idle"); setPct(0) }} onEdit={() => setStep(2)} />}

      {phase === "idle" && (
        <div className="space-y-5">
          {/* Thumbnail */}
          {MAPBOX_TOKEN && (
            <div className="overflow-hidden rounded-2xl border border-white/8 bg-white/3">
              <img src={thumbnailUrl} alt="Plot view" className="w-full object-cover" style={{ height: 200 }}
                loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
              <div className="flex items-center gap-2 px-4 py-2.5 border-t border-white/6">
                <MapPin size={11} className="text-[#7F77DD]" />
                <span className="text-xs text-white/50 truncate">
                  {[plot.locality?.split(",")[0], plot.locationCity].filter(Boolean).join(", ") || "Satellite view"}
                </span>
                {plot.plotAreaSqft && <span className="ml-auto text-xs font-medium text-white/60">{f(plot.plotAreaSqft)} sqft</span>}
              </div>
            </div>
          )}

          <SummaryCard title="Plot" icon="🗺️" rows={plotRows} />
          <SummaryCard title="Project" icon="🏢" rows={projectRows} />

          {/* Programme */}
          {(totalUnits > 0 || amenities.length > 0) && (
            <div className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/35">Programme</p>
              {totalUnits > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1.5">Unit mix</p>
                  <div className="flex flex-wrap gap-1.5">
                    {enabledUnits.map(u => (
                      <span key={u.type} className="rounded-full border border-[#7F77DD]/25 bg-[#7F77DD]/10 px-2.5 py-1 text-xs font-medium text-[#7F77DD]">
                        {u.count}× {BHK[u.type]}
                      </span>
                    ))}
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/40">{totalUnits} total</span>
                  </div>
                </div>
              )}
              {amenities.length > 0 && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Amenities ({amenities.length})</p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    {amenities.map(id => id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())).join(" · ")}
                  </p>
                </div>
              )}
              {specialNotes && (
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-xs text-white/45 italic">&ldquo;{specialNotes}&rdquo;</p>
                </div>
              )}
            </div>
          )}

          {/* CTA block */}
          <div className="rounded-2xl border border-[#7F77DD]/20 bg-[#7F77DD]/6 p-5 space-y-4">
            <div className="flex items-center gap-2 text-xs text-white/40">
              <Clock size={12} className="text-[#7F77DD]/60" />
              Estimated time: <span className="text-white font-medium">~25 seconds</span>
              &nbsp;·&nbsp; Uses <span className="text-white font-medium">1 design credit</span>
            </div>
            <Button id="review-generate-btn" size="lg"
              className="w-full gap-2 text-base py-6 shadow-xl shadow-[#7F77DD]/20"
              onClick={handleGenerate}>
              <Zap size={18} />
              Generate feasibility + layouts
              <ArrowUpRight size={15} className="ml-auto opacity-60" />
            </Button>
            <p className="text-[10px] text-white/25 text-center leading-relaxed">
              Claude Sonnet will analyse your brief and produce 3 unique building configurations.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
