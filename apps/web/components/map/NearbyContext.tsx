"use client"

import { useEffect, useRef, useState } from "react"
import { useNewProjectStore } from "@/store/new-project"
import { Loader2, School, Building2, Train, ShoppingBag, AlertCircle } from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Overpass API types + helpers
// ─────────────────────────────────────────────────────────────

const OVERPASS_URL = "https://overpass-api.de/api/interpreter"
const RADIUS_M = 1000

interface OverpassNode {
  type: "node"
  id: number
  lat: number
  lon: number
  tags: Record<string, string>
}

/** Build Overpass QL query for four amenity categories around a point. */
function buildOverpassQuery(lat: number, lng: number): string {
  const R = RADIUS_M
  return (
    `[out:json][timeout:15];` +
    `(` +
    // Education
    `node["amenity"="school"](around:${R},${lat},${lng});` +
    `node["amenity"="college"](around:${R},${lat},${lng});` +
    // Health
    `node["amenity"="hospital"](around:${R},${lat},${lng});` +
    `node["amenity"="clinic"](around:${R},${lat},${lng});` +
    // Transit (Metro / Suburban Rail)
    `node["railway"="station"](around:${R},${lat},${lng});` +
    `node["station"="subway"](around:${R},${lat},${lng});` +
    `node["railway"="subway_entrance"](around:${R},${lat},${lng});` +
    // Retail
    `node["shop"="supermarket"](around:${R},${lat},${lng});` +
    `node["shop"="mall"](around:${R},${lat},${lng});` +
    `);out body;`
  )
}

/** Haversine distance in metres between two lat/lng pairs. */
function haversineM(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const Δlat = toRad(lat2 - lat1)
  const Δlon = toRad(lon2 - lon1)
  const a =
    Math.sin(Δlat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(Δlon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDist(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10}m`
  return `${(m / 1000).toFixed(1)}km`
}

// ─────────────────────────────────────────────────────────────
// Categorise nodes
// ─────────────────────────────────────────────────────────────

interface NearbyData {
  schoolCount: number
  hospitalCount: number
  metroCount: number
  nearestMetroM: number | null
  supermarketCount: number
}

function categorise(nodes: OverpassNode[], centLat: number, centLng: number): NearbyData {
  const schools: OverpassNode[] = []
  const hospitals: OverpassNode[] = []
  const metros: OverpassNode[] = []
  const supermarkets: OverpassNode[] = []

  for (const n of nodes) {
    const t = n.tags ?? {}
    if (t.amenity === "school" || t.amenity === "college") schools.push(n)
    if (t.amenity === "hospital" || t.amenity === "clinic") hospitals.push(n)
    if (
      t.railway === "station" ||
      t.station === "subway" ||
      t.railway === "subway_entrance"
    )
      metros.push(n)
    if (t.shop === "supermarket" || t.shop === "mall") supermarkets.push(n)
  }

  // Nearest metro distance (using Haversine — Turf not needed for a simple distance)
  let nearestMetroM: number | null = null
  for (const m of metros) {
    const d = haversineM(centLat, centLng, m.lat, m.lon)
    if (nearestMetroM === null || d < nearestMetroM) nearestMetroM = d
  }

  return {
    schoolCount: schools.length,
    hospitalCount: hospitals.length,
    metroCount: metros.length,
    nearestMetroM,
    supermarketCount: supermarkets.length,
  }
}

/** Build the human-readable context string stored in Zustand / sent to Claude. */
function buildContextString(data: NearbyData): string {
  const parts: string[] = []
  if (data.schoolCount > 0)
    parts.push(`${data.schoolCount} school${data.schoolCount > 1 ? "s" : ""}`)
  if (data.hospitalCount > 0)
    parts.push(`${data.hospitalCount} hospital${data.hospitalCount > 1 ? "s" : ""}`)
  if (data.metroCount > 0 && data.nearestMetroM !== null)
    parts.push(`Metro ${formatDist(data.nearestMetroM)}`)
  if (data.supermarketCount > 0)
    parts.push(
      `${data.supermarketCount} supermarket${data.supermarketCount > 1 ? "s" : ""}`
    )
  return parts.length > 0 ? parts.join(" · ") : "No major amenities found within 1km"
}

// ─────────────────────────────────────────────────────────────
// Category pill row
// ─────────────────────────────────────────────────────────────

interface PillProps {
  icon: React.ElementType
  count: number | string
  label: string
  highlight?: boolean
}

function Pill({ icon: Icon, count, label, highlight }: PillProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-white/6 px-2.5 py-1.5">
      <Icon
        size={11}
        className={highlight ? "text-[#7F77DD]" : "text-white/40"}
      />
      <span className="text-xs font-medium text-white tabular-nums">{count}</span>
      <span className="text-xs text-white/40">{label}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// NearbyContext component
// ─────────────────────────────────────────────────────────────

interface NearbyContextProps {
  /** [lng, lat] — Mapbox convention */
  centroid: [number, number]
  /** Called when the context string is ready so parent can use it */
  onReady?: (contextString: string) => void
}

export function NearbyContext({ centroid, onReady }: NearbyContextProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [data, setData] = useState<NearbyData | null>(null)
  const [contextStr, setContextStr] = useState<string | null>(null)
  const [hasError, setHasError] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const { setPlotFromDraw } = useNewProjectStore()

  useEffect(() => {
    const [lng, lat] = centroid

    // Cancel any in-flight request
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setIsLoading(true)
    setHasError(false)
    setData(null)

    const query = buildOverpassQuery(lat, lng)

    fetch(OVERPASS_URL, {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Overpass HTTP ${r.status}`)
        return r.json()
      })
      .then((json: { elements?: OverpassNode[] }) => {
        const nodes = json.elements ?? []
        const result = categorise(nodes, lat, lng)
        const ctx = buildContextString(result)

        setData(result)
        setContextStr(ctx)

        // Persist to Zustand so Claude prompt can include it
        setPlotFromDraw({ nearbyContext: ctx } as never)
        onReady?.(ctx)
        setIsLoading(false)
      })
      .catch((err: Error) => {
        if (err.name === "AbortError") return
        console.warn("Overpass query failed:", err.message)
        setHasError(true)
        setIsLoading(false)
      })

    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centroid[0], centroid[1]])

  // ── Loading ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-1">
        <Loader2 size={12} className="animate-spin text-[#7F77DD] shrink-0" />
        <span className="text-xs text-white/40">Scanning nearby amenities…</span>
      </div>
    )
  }

  // ── Error / no data ──────────────────────────────────────────
  if (hasError || !data) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <AlertCircle size={12} className="text-white/25 shrink-0" />
        <span className="text-xs text-white/30">Could not load amenities</span>
      </div>
    )
  }

  // ── Render pills ─────────────────────────────────────────────
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-white/30">
        Nearby · 1km radius
      </p>

      {/* Pills row */}
      <div className="flex flex-wrap gap-1.5">
        {data.schoolCount > 0 && (
          <Pill icon={School} count={data.schoolCount} label="school" />
        )}
        {data.hospitalCount > 0 && (
          <Pill icon={Building2} count={data.hospitalCount} label="hospital" />
        )}
        {data.metroCount > 0 && data.nearestMetroM !== null && (
          <Pill
            icon={Train}
            count={formatDist(data.nearestMetroM)}
            label="metro"
            highlight
          />
        )}
        {data.supermarketCount > 0 && (
          <Pill icon={ShoppingBag} count={data.supermarketCount} label="market" />
        )}
        {data.schoolCount === 0 &&
          data.hospitalCount === 0 &&
          data.metroCount === 0 &&
          data.supermarketCount === 0 && (
            <p className="text-xs text-white/30">No major amenities within 1km</p>
          )}
      </div>

      {/* Single-line summary (stored in Zustand) */}
      {contextStr && (
        <p className="text-[11px] text-white/30 leading-relaxed">{contextStr}</p>
      )}
    </div>
  )
}
