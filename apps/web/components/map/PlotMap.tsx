"use client"

import { useEffect, useRef, useState, useCallback } from "react"
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
} from "lucide-react"

import type { Feature, Polygon } from "geojson"

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MUMBAI_CENTER: [number, number] = [72.8777, 19.076]
const DEFAULT_ZOOM = 17
const GEOCODE_ZOOM = 19

// Custom styles for MapboxDraw — #7F77DD theme
const DRAW_STYLES = [
  {
    id: "gl-draw-polygon-fill-inactive",
    type: "fill",
    filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"], ["!=", "meta", "mousePosition"]],
    paint: { "fill-color": "#7F77DD", "fill-opacity": 0.15 },
  },
  {
    id: "gl-draw-polygon-fill-active",
    type: "fill",
    filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
    paint: { "fill-color": "#7F77DD", "fill-opacity": 0.22 },
  },
  {
    id: "gl-draw-polygon-stroke-inactive",
    type: "line",
    filter: ["all", ["==", "active", "false"], ["==", "$type", "Polygon"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#7F77DD", "line-width": 2 },
  },
  {
    id: "gl-draw-polygon-stroke-active",
    type: "line",
    filter: ["all", ["==", "active", "true"], ["==", "$type", "Polygon"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#7F77DD", "line-width": 2.5, "line-dasharray": [0.2, 2] },
  },
  {
    id: "gl-draw-line-active",
    type: "line",
    filter: ["all", ["==", "$type", "LineString"], ["==", "active", "true"]],
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#7F77DD", "line-width": 2 },
  },
  {
    id: "gl-draw-polygon-midpoint",
    type: "circle",
    filter: ["all", ["==", "$type", "Point"], ["==", "meta", "midpoint"]],
    paint: { "circle-radius": 4, "circle-color": "#7F77DD", "circle-stroke-width": 1, "circle-stroke-color": "#fff" },
  },
  {
    id: "gl-draw-polygon-vertex-inactive",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    paint: { "circle-radius": 5, "circle-fill-color": "#fff", "circle-stroke-color": "#7F77DD", "circle-stroke-width": 2 },
  },
  {
    id: "gl-draw-polygon-vertex-active",
    type: "circle",
    filter: ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"]],
    paint: { "circle-radius": 7, "circle-color": "#fff", "circle-stroke-color": "#7F77DD", "circle-stroke-width": 2.5 },
  },
]

// ─────────────────────────────────────────────────────────────
// Geocoding helpers (direct Mapbox Geocoding API — no extra pkg)
// ─────────────────────────────────────────────────────────────

interface GeocodingFeature {
  id: string
  place_name: string
  center: [number, number]
  context?: { id: string; text: string }[]
}

async function forwardGeocode(query: string, token: string): Promise<GeocodingFeature[]> {
  if (!query.trim() || query.length < 3) return []
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${token}&limit=5&types=address,place,poi,locality,neighborhood&country=IN`
  const res = await fetch(url)
  const json = await res.json()
  return json.features ?? []
}

async function reverseGeocode(
  lng: number,
  lat: number,
  token: string
): Promise<{ locality: string | null; city: string | null; state: string | null }> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&types=neighborhood,locality,place,region&limit=1`
  const res = await fetch(url)
  const json = await res.json()
  const feature = json.features?.[0]
  if (!feature) return { locality: null, city: null, state: null }

  const ctx: { id: string; text: string }[] = feature.context ?? []
  const locality = feature.place_name?.split(",")[0] ?? null
  const city = ctx.find((c) => c.id.startsWith("place"))?.text ?? null
  const state = ctx.find((c) => c.id.startsWith("region"))?.text ?? null
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
  centroid: [number, number]
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
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 z-10 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-4 shadow-2xl space-y-3 max-h-[calc(100vh-100px)] overflow-y-auto">
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
  token,
  onSelect,
}: {
  token: string
  onSelect: (lnglat: [number, number], placeName: string) => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GeocodingFeature[]>([])
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
        const features = await forwardGeocode(val, token)
        setResults(features)
        setIsOpen(features.length > 0)
      } finally {
        setIsLoading(false)
      }
    }, 350)
  }

  function handleSelect(feature: GeocodingFeature) {
    setQuery(feature.place_name)
    setResults([])
    setIsOpen(false)
    onSelect(feature.center, feature.place_name)
  }

  return (
    <div className="absolute top-3 left-3 right-3 sm:left-3 sm:right-auto sm:w-80 z-10">
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
              key={f.id}
              onClick={() => handleSelect(f)}
              className={cn(
                "flex items-center gap-2 w-full px-3 py-2.5 text-sm text-left hover:bg-white/8 transition-colors",
                i > 0 && "border-t border-white/6"
              )}
            >
              <MapPin size={12} className="text-[#7F77DD] shrink-0" />
              <span className="text-white/80 truncate">{f.place_name}</span>
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
    <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 z-10 rounded-2xl border border-white/10 bg-black/70 backdrop-blur-xl p-4 shadow-2xl">
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
// Main PlotMap component
// ─────────────────────────────────────────────────────────────

export function PlotMap() {
  const mounted = useIsMounted()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const drawRef = useRef<MapboxDraw | null>(null)

  const { nextStep, setPlotFromDraw, plot } = useNewProjectStore()
  const [plotInfo, setPlotInfo] = useState<PlotInfo | null>(null)
  const [isManual, setIsManual] = useState(plot.isManualEntry)
  const [mapReady, setMapReady] = useState(false)

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ""

  // ── Handle polygon drawn / updated ──────────────────────────
  const handleDraw = useCallback(
    async (features: Feature<Polygon>[]) => {
      const feature = features[0]
      if (!feature) return

      try {
        const metrics = await computeMetrics(feature)
        const geo = await reverseGeocode(
          metrics.centroid[0],
          metrics.centroid[1],
          MAPBOX_TOKEN
        )

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
    [MAPBOX_TOKEN, setPlotFromDraw]
  )

  // ── Initialize map ──────────────────────────────────────────
  useEffect(() => {
    if (!mounted || !mapContainerRef.current || mapRef.current) return

    let cancelled = false

    async function initMap() {
      // Dynamic imports — safe for SSR
      const mapboxgl = (await import("mapbox-gl")).default
      const MapboxDraw = (await import("@mapbox/mapbox-gl-draw")).default

      if (cancelled || !mapContainerRef.current) return

      mapboxgl.accessToken = MAPBOX_TOKEN

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: MUMBAI_CENTER,
        zoom: DEFAULT_ZOOM,
        attributionControl: false,
      })

      mapRef.current = map

      // Add navigation controls
      map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false }),
        "bottom-right"
      )

      // MapboxDraw with custom styles
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
        styles: DRAW_STYLES as never,
      })

      map.addControl(draw, "bottom-right")
      drawRef.current = draw

      map.on("load", () => {
        if (!cancelled) setMapReady(true)
      })

      // Draw event handlers
      const onDraw = () => {
        const data = draw.getAll()
        const polygons = data.features.filter(
          (f) => f.geometry.type === "Polygon"
        ) as Feature<Polygon>[]
        if (polygons.length > 0) handleDraw(polygons)
        else setPlotInfo(null)
      }

      map.on("draw.create", onDraw)
      map.on("draw.update", onDraw)
      map.on("draw.delete", () => {
        setPlotInfo(null)
        setPlotFromDraw({ plotGeoJSON: null, plotAreaSqft: null })
      })
    }

    initMap()

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      drawRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted])

  // ── Geocoder → fly to ────────────────────────────────────────
  function handleGeocoderSelect(lnglat: [number, number]) {
    mapRef.current?.flyTo({ center: lnglat, zoom: GEOCODE_ZOOM, duration: 1200 })
  }

  // ── Clear drawing ─────────────────────────────────────────────
  function handleClear() {
    drawRef.current?.deleteAll()
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
      {/* ── Map container ── */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* ── Map CSS (loaded once) ── */}
      <link
        rel="stylesheet"
        href="https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css"
      />
      <link
        rel="stylesheet"
        href="https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-draw/v1.4.3/mapbox-gl-draw.css"
      />

      {/* ── Geocoder search ── */}
      {mapReady && !isManual && (
        <GeocoderSearch token={MAPBOX_TOKEN} onSelect={handleGeocoderSelect} />
      )}

      {/* ── Toolbar: clear + toggle ── */}
      {mapReady && (
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
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
      )}

      {/* ── Floating draw hint ── */}
      {mapReady && !isManual && !plotInfo && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-white/15 bg-black/65 backdrop-blur-md px-4 py-2.5 shadow-lg pointer-events-none">
          <Pencil size={13} className="text-[#7F77DD] animate-pulse" />
          <span className="text-xs font-medium text-white/70">
            Click the <span className="text-white">polygon tool</span> (bottom-right) to draw your plot
          </span>
        </div>
      )}

      {/* ── Info panel (after drawing) ── */}
      {mapReady && !isManual && plotInfo && (
        <InfoPanel
          info={plotInfo}
          onNext={nextStep}
        />
      )}

      {/* ── Manual entry panel ── */}
      {mapReady && isManual && (
        <ManualEntry onConfirm={nextStep} />
      )}

      {/* ── Loading overlay ── */}
      {!mapReady && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0b10]">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-[#7F77DD] border-t-transparent animate-spin" />
            <p className="text-sm text-white/40">Loading satellite map…</p>
          </div>
        </div>
      )}
    </div>
  )
}
