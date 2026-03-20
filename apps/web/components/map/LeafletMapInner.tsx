"use client"

import { useEffect, useRef, useState } from "react"
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet"
import { Layers } from "lucide-react"
import type { Feature, Polygon } from "geojson"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"

// Fix for default markers in react-leaflet
import L from "leaflet"
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
})

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const MUMBAI_CENTER: [number, number] = [19.0760, 72.8777] // [lat, lng] for Leaflet
const DEFAULT_ZOOM = 17

// ─────────────────────────────────────────────────────────────
// Drawing Control Component
// ─────────────────────────────────────────────────────────────

interface DrawingControlProps {
  onDraw: (feature: Feature<Polygon>) => void
  onClear: () => void
}

function DrawingControl({ onDraw, onClear }: DrawingControlProps) {
  const map = useMap()
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const drawControlRef = useRef<L.Control.Draw | null>(null)

  useEffect(() => {
    const loadDrawing = async () => {
      // Dynamic import of leaflet-draw
      await import("leaflet-draw")

      // Create feature group for drawn items
      const drawnItems = new L.FeatureGroup()
      map.addLayer(drawnItems)
      drawnItemsRef.current = drawnItems

      // Create draw control
      const drawControl = new L.Control.Draw({
        position: "bottomright",
        draw: {
          polygon: {
            allowIntersection: false,
            drawError: {
              color: "#e1e100",
              message: "<strong>Error:</strong> Shape edges cannot cross!",
            },
            shapeOptions: {
              color: "#7F77DD",
              fillColor: "#7F77DD",
              fillOpacity: 0.2,
              weight: 2,
            },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          marker: false,
          circlemarker: false,
        },
        edit: {
          featureGroup: drawnItems,
          remove: true,
        },
      })

      map.addControl(drawControl)
      drawControlRef.current = drawControl

      // Event handlers
      map.on(L.Draw.Event.CREATED, (e: any) => {
        const layer = e.layer
        drawnItems.addLayer(layer)

        // Convert to GeoJSON
        const geoJson = layer.toGeoJSON() as Feature<Polygon>
        onDraw(geoJson)
      })

      map.on(L.Draw.Event.EDITED, (e: any) => {
        const layers = e.layers
        layers.eachLayer((layer: any) => {
          const geoJson = layer.toGeoJSON() as Feature<Polygon>
          onDraw(geoJson)
        })
      })

      map.on(L.Draw.Event.DELETED, () => {
        onClear()
      })
    }

    loadDrawing()

    return () => {
      if (drawControlRef.current) {
        map.removeControl(drawControlRef.current)
      }
      if (drawnItemsRef.current) {
        map.removeLayer(drawnItemsRef.current)
      }
    }
  }, [map, onDraw, onClear])

  return null
}

// ─────────────────────────────────────────────────────────────
// Layer Toggle Component
// ─────────────────────────────────────────────────────────────

function LayerToggle() {
  const [isStreet, setIsStreet] = useState(true)

  return (
    <div className="absolute top-16 right-3 z-[1000]">
      <button
        onClick={() => setIsStreet(!isStreet)}
        className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/60 backdrop-blur-md px-2.5 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-black/80 transition-all shadow"
      >
        <Layers size={14} />
        {isStreet ? "Satellite" : "Map"}
      </button>
      
      {/* Hidden tile layers - controlled by state */}
      <div style={{ display: "none" }}>
        {isStreet ? (
          <TileLayer
            key="street"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        ) : (
          <TileLayer
            key="satellite"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri, Maxar, GeoEye"
          />
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Geocoder Handler
// ─────────────────────────────────────────────────────────────

function GeocoderHandler({ searchResult }: { searchResult: [number, number] | null }) {
  const map = useMap()

  useEffect(() => {
    if (searchResult) {
      map.flyTo(searchResult, 18, { duration: 1.2 })
    }
  }, [map, searchResult])

  return null
}

// ─────────────────────────────────────────────────────────────
// Main Leaflet Map Component
// ─────────────────────────────────────────────────────────────

export interface LeafletMapInnerProps {
  onDraw: (feature: Feature<Polygon>) => void
  onClear: () => void
  isManual: boolean
}

export default function LeafletMapInner({ onDraw, onClear, isManual }: LeafletMapInnerProps) {
  const [isStreet, setIsStreet] = useState(true)
  const [searchResult, setSearchResult] = useState<[number, number] | null>(null)

  return (
    <div className="absolute inset-0">
      <MapContainer
        center={MUMBAI_CENTER}
        zoom={DEFAULT_ZOOM}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        attributionControl={false}
      >
        {/* Base tile layer */}
        {isStreet ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
        ) : (
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Esri, Maxar, GeoEye"
          />
        )}

        {/* Drawing controls */}
        {!isManual && <DrawingControl onDraw={onDraw} onClear={onClear} />}

        {/* Geocoder handler */}
        <GeocoderHandler searchResult={searchResult} />

        {/* Zoom control */}
        <div className="leaflet-control-container">
          <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control-zoom leaflet-bar leaflet-control">
              <a
                className="leaflet-control-zoom-in"
                href="#"
                title="Zoom in"
                role="button"
                aria-label="Zoom in"
                onClick={(e) => {
                  e.preventDefault()
                  // Will be handled by Leaflet
                }}
              >
                +
              </a>
              <a
                className="leaflet-control-zoom-out"
                href="#"
                title="Zoom out"
                role="button"
                aria-label="Zoom out"
                onClick={(e) => {
                  e.preventDefault()
                  // Will be handled by Leaflet
                }}
              >
                −
              </a>
            </div>
          </div>
        </div>
      </MapContainer>

      {/* Layer toggle button */}
      <div className="absolute top-16 right-3 z-[1000]">
        <button
          onClick={() => setIsStreet(!isStreet)}
          className="flex items-center gap-1.5 rounded-lg border border-white/12 bg-black/60 backdrop-blur-md px-2.5 py-2 text-xs font-medium text-white/70 hover:text-white hover:bg-black/80 transition-all shadow"
        >
          <Layers size={14} />
          {isStreet ? "Satellite" : "Map"}
        </button>
      </div>
    </div>
  )
}