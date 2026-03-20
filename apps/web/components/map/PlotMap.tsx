"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { useIsMounted } from "@/hooks/use-is-mounted"
import { useNewProjectStore } from "@/store/new-project"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { NearbyContext } from "@/components/map/NearbyContext"
import {
  Pencil,
  Trash2,
  Search,
  X,
  MapPin,
  Ruler,
  ChevronRight,
  ToggleLeft,
  ToggleRight,
  Layers,
} from "lucide-react"

import type { Feature, Polygon } from "geojson"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MUMBAI_CENTER: [number, number] = [19.0760, 72.8777] // [lat, lng] for Leaflet
const DEFAULT_ZOOM = 17
const GEOCODE_ZOOM = 18

// ─────────────────────────────────────────────────────────────
// Geocoding helpers (Nominatim - free, no API key)
// ─────────────────────────────────────────────────────────────

interface NominatimFeature {
  place_id: number
  display_name: string
  lat: string
  lon: string
  address?: {
    suburb?: string
    neighbourhood?: string
    city?: string
    state?: string
  }
}

async function forwardGeocode(query: string): Promise<NominatimFeature[]> {
  if (!query.trim() || query.length < 3) return []
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=in`
  const res = await fetch(url, {
    headers: { "User-Agent": "DesignAI/1.0" }
  })
  const json = await res.json()
  return json ?? []
}

async function reverseGeocode(
  lat: number,
  lng: number
): Promise<{ locality: string | null; city: string | null; state: string | null }> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`
  const res = await fetch(url, {
    headers: { "User-Agent": "DesignAI/1.0" }
  })
  const json = await res.json()
  
  if (!json.address) return { locality: null, city: null, state: null }

  const locality = json.address.suburb || json.address.neighbourhood || json.address.city || null
  const city = json.address.city || null
  const state = json.address.state || null
  
  return { locality, city, state }
}

// ─────────────────────────────────────────────────────────────
// Turf calculations (dynamic import)
// ─────────────────────────────────────────────────────────────

interface PlotMetrics {
  areaSqm: number
  areaSqft: number
  areaCents: number
  lengthFt: number  // longest edge in feet
  widthFt: number   // shortest edge in feet
  centroid: [number, number] // [lng, lat] for GeoJSON
}

async function computeMetrics(geojson: Feature<Polygon>): Promise<PlotMetrics> {
  const turf = await import("@turf/turf")

  const areaSqm = turf.area(geojson)
  const areaSqft = areaSqm * 10.7639
  const areaCents = areaSqm / 40.4686

  // Edge lengths
  const coords = geojson.geometry.coordinates[0]
  const edgeLengthsM: number[] = []
  for (let i = 0; i < coords.length - 1; i++) {
    const d = turf.distance(turf.point(coords[i]), turf.point(coords[i + 1]), {
      units: "meters",
    })
    edgeLengthsM.push(d)
  }
  const maxM = Math.max(...edgeLengthsM)
  const minM = Math.min(...edgeLengthsM)

  const centroidFeature = turf.centroid(geojson)
  const centroid = centroidFeature.geometry.coordinates as [number, number]

  return {
    areaSqm,
    areaSqft,
    areaCents,
    lengthFt: maxM * 3.28084,
    widthFt: minM * 3.28084,
    centroid,
  }
}

// ─────────────────────────────────────────────────────────────
// Plot info panel
// ─────────────────────────────────────────────────────────────

interface PlotInfo {
  areaSqft: number
  areaSqm: number
  areaCents: number
  lengthFt: number
  widthFt: number
  locality: string | null
  city: string | null
  /** [lng, lat] centroid — used by NearbyContext for Overpass query */
  centroid: [number, number]
}

function InfoPanel({ info, onNext }: { info: PlotInfo; onNext: () => void }) {
  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-[1000] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-4 shadow-2xl space-y-3 max-h-[calc(100vh-100px)] overflow-y-auto">
      {/* Locality */}
      {info.locality && (
        <div className="flex items-center gap-1.5">
          <MapPin size={12} className="text-[#7F77DD] shrink-0" />
          <span className="text-xs font-medium text-white truncate">
            {info.locality}
            {info.city ? `, ${info.city}` : ""}
          </span>
        </div>
      )}

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/5 p-2.5">
          <p className="text-lg font-bold text-white tabular-nums leading-tight">
            {info.areaSqft.toFixed(0)}
          </p>
          <p className="text-xs text-white/45">sq ft</p>
        </div>
        <div className="rounded-lg bg-white/5 p-2.5">
          <p className="text-lg font-bold text-white tabular-nums leading-tight">
            {info.areaCents.toFixed(2)}
          </p>
          <p className="text-xs text-white/45">cents</p>
        </div>
        <div className="rounded-lg bg-white/5 p-2.5">
          <p className="text-sm font-semibold text-white tabular-nums">
            {info.areaSqm.toFixed(1)}
          </p>
          <p className="text-xs text-white/45">sq m</p>
        </div>
        <div className="rounded-lg bg-white/5 p-2.5">
          <div className="flex items-center gap-1">
            <Ruler size={10} className="text-white/40" />
            <p className="text-xs font-medium text-white/70 tabular-nums">
              {info.lengthFt.toFixed(0)} × {info.widthFt.toFixed(0)} ft
            </p>
          </div>
          <p className="text-xs text-white/45">L × W</p>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-white/8" />

      {/* Nearby amenities */}
      <NearbyContext centroid={info.centroid} />

      {/* Divider */}
      <div className="border-t border-white/8" />

      {/* CTA */}
      <Button id="map-step1-next" size="sm" className="w-full gap-1" onClick={onNext}>
        Looks good, continue →
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Geocoder search box
// ─────────────────────────────────────────────────────────────

function GeocoderSearch({
  onSelect,
}: {
  onSelect: (latlng: [number, number], placeName: string) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<NominatimFeature[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim() || val.length < 3) {
      setResults([])
      setIsOpen(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true)
      try {
        const features = await forwardGeocode(val)
        setResults(features)
        setIsOpen(features.length > 0)
      } finally {
        setIsLoading(false)
      }
    }, 350)
  }

  function handleSelect(feature: NominatimFeature) {
    setQuery(feature.display_name)
    setResults([])
    setIsOpen(false)
    onSelect([parseFloat(feature.lat), parseFloat(feature.lon)], feature.display_name)
  }

  return (
    <div className="absolute top-3 left-3 right-3 sm:left-3 sm:right-auto sm:w-80 z-[1000]">
      <div className="relative">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
        <input
          id="map-geocoder"
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="Search address or area…"
          className="w-full rounded-xl border border-white/12 bg-black/60 backdrop-blur-md pl-8 pr-8 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-[#7F77DD]/60 shadow-lg"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setResults([]); setIsOpen(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            aria-label="Clear search"
          >
            <X size={13} />
          </button>
        )}
        {isLoading && (
          <div className="absolute right-8 top-1/2 -translate-y-1/2">
            <div className="h-3 w-3 rounded-full border border-[#7F77DD] border-t-transparent animate-spin" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && results.length > 0 && (
        <div className="mt-1.5 rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl overflow-hidden shadow-2xl">
          {results.map((f, i) => (
            <button
              key={f.place_id}
              onClick={() => handleSelect(f)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-white/8 transition-colors",
                i > 0 && "border-t border-white/6"
              )}
            >
              <MapPin size={12} className="text-[#7F77DD] shrink-0" />
              <span className="text-white/80 truncate">{f.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Manual entry panel
// ─────────────────────────────────────────────────────────────

function ManualEntry({ onConfirm }: { onConfirm: () => void }) {
  const { plot, setPlotManual } = useNewProjectStore()
  const [length, setLength] = useState(plot.plotLengthFt?.toString() ?? "")
  const [width, setWidth] = useState(plot.plotWidthFt?.toString() ?? "")

  const area = length && width ? Number(length) * Number(width) : null
  const areaSqm = area ? area * 0.092903 : null
  const areaCents = areaSqm ? areaSqm / 40.4686 : null

  function handleApply() {
    if (!length || !width) return
    setPlotManual(Number(length), Number(width))
    onConfirm()
  }

  return (
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-[1000] rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-4 shadow-2xl">
      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-3">
        Enter dimensions manually
      </p>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-white/40 mb-1 block">Length (ft)</label>
          <input
            id="manual-length"
            type="number"
            min={1}
            value={length}
            onChange={(e) => {
              setLength(e.target.value)
              if (e.target.value && width) setPlotManual(Number(e.target.value), Number(width))
            }}
            className="w-full rounded-lg border border-white/10 bg-white/6 px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#7F77DD]"
          />
        </div>
        <div>
          <label className="text-xs text-white/40 mb-1 block">Width (ft)</label>
          <input
            id="manual-width"
            type="number"
            min={1}
            value={width}
            onChange={(e) => {
              setWidth(e.target.value)
              if (length && e.target.value) setPlotManual(Number(length), Number(e.target.value))
            }}
            className="w-full rounded-lg border border-white/10 bg-white/6 px-2.5 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#7F77DD]"
          />
        </div>
      </div>

      {area !== null && (
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          {[
            [area.toFixed(0), "sq ft"],
            [areaSqm!.toFixed(1), "sq m"],
            [areaCents!.toFixed(2), "cents"],
          ].map(([v, unit]) => (
            <div key={unit} className="rounded-lg bg-white/5 p-2 text-center">
              <p className="text-sm font-bold text-white">{v}</p>
              <p className="text-xs text-white/40">{unit}</p>
            </div>
          ))}
        </div>
      )}

      <Button
        id="manual-step1-next"
        size="sm"
        className="w-full"
        disabled={!length || !width}
        onClick={handleApply}
      >
        Use these dimensions <ChevronRight size={14} />
      </Button>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Leaflet Map Component (dynamically imported)
// ─────────────────────────────────────────────────────────────

const LeafletMap = dynamic(
  () => import("@/components/map/LeafletMapInner"),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0b10]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-[#7F77DD] border-t-transparent animate-spin" />
          <p className="text-sm text-white/40">Loading map…</p>
        </div>
      </div>
    ),
  }
) as React.ComponentType<{
  onDraw: (feature: Feature<Polygon>) => void
  onClear: () => void
  isManual: boolean
}>

// ─────────────────────────────────────────────────────────────
// Main PlotMap component
// ─────────────────────────────────────────────────────────────

export function PlotMap() {
  const mounted = useIsMounted()
  const { nextStep, setPlotFromDraw, plot } = useNewProjectStore()
  const [plotInfo, setPlotInfo] = useState<PlotInfo | null>(null)
  const [isManual, setIsManual] = useState(plot.isManualEntry)

  // ── Handle polygon drawn / updated ──────────────────────────
  const handleDraw = useCallback(
    async (feature: Feature<Polygon>) => {
      try {
        const metrics = await computeMetrics(feature)
        const geo = await reverseGeocode(metrics.centroid[1], metrics.centroid[0])

        const info: PlotInfo = {
          areaSqft: metrics.areaSqft,
          areaSqm: metrics.areaSqm,
          areaCents: metrics.areaCents,
          lengthFt: metrics.lengthFt,
          widthFt: metrics.widthFt,
          locality: geo.locality,
          city: geo.city,
          centroid: metrics.centroid,
        }

        setPlotInfo(info)
        setPlotFromDraw({
          plotGeoJSON: feature,
          plotAreaSqm: metrics.areaSqm,
          plotAreaSqft: metrics.areaSqft,
          plotAreaCents: metrics.areaCents,
          plotLengthFt: metrics.lengthFt,
          plotWidthFt: metrics.widthFt,
          locality: geo.locality,
          locationCity: geo.city,
          locationState: geo.state,
          locationLat: metrics.centroid[1],
          locationLng: metrics.centroid[0],
        })
      } catch (err) {
        console.error("Metrics error:", err)
      }
    },
    [setPlotFromDraw]
  )

  // ── Clear drawing ─────────────────────────────────────────────
  function handleClear() {
    setPlotInfo(null)
    setPlotFromDraw({
      plotGeoJSON: null,
      plotAreaSqft: null,
      plotAreaSqm: null,
      plotAreaCents: null,
      plotLengthFt: null,
      plotWidthFt: null,
    })
  }

  // ── Toggle manual entry ───────────────────────────────────────
  function toggleManual() {
    setIsManual((v) => !v)
    setPlotFromDraw({ isManualEntry: !isManual } as never)
  }

  if (!mounted) return null

  return (
    <div className="relative w-full h-[60vh] md:h-full">
      {/* ── Leaflet Map ── */}
      <LeafletMap
        onDraw={handleDraw}
        onClear={handleClear}
        isManual={isManual}
      />

      {/* ── Geocoder search ── */}
      {!isManual && (
        <GeocoderSearch onSelect={() => {}} />
      )}

      {/* ── Toolbar: clear + toggle ── */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {/* Manual entry toggle */}
        <button
          id="map-toggle-manual"
          onClick={toggleManual}
          className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/60 backdrop-blur-md px-2.5 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-black/80 transition-all shadow"
        >
          {isManual ? (
            <>
              <ToggleRight size={14} className="text-[#7F77DD]" />
              Draw map
            </>
          ) : (
            <>
              <ToggleLeft size={14} />
              Enter manually
            </>
          )}
        </button>

        {/* Clear drawing */}
        {plotInfo && !isManual && (
          <button
            id="map-clear-draw"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-black/60 backdrop-blur-md px-2.5 py-2 text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all shadow"
          >
            <Trash2 size={13} />
            Clear
          </button>
        )}
      </div>

      {/* ── Floating draw hint ── */}
      {!isManual && !plotInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full border border-white/15 bg-black/65 backdrop-blur-md px-4 py-2.5 shadow-lg pointer-events-none">
          <Pencil size={13} className="text-[#7F77DD] animate-pulse" />
          <span className="text-xs font-medium text-white/70">
            Click the map to start drawing your plot boundary
          </span>
        </div>
      )}

      {/* ── Info panel (after drawing) ── */}
      {!isManual && plotInfo && (
        <InfoPanel
          info={plotInfo}
          onNext={nextStep}
        />
      )}

      {/* ── Manual entry panel ── */}
      {isManual && (
        <ManualEntry onConfirm={nextStep} />
      )}
    </div>
  )
}
