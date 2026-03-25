'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface PlotSelectorProps {
  onPlotSelect: (coordinates: number[][], area: number) => void
  initialLocation?: [number, number]
}

export default function PlotSelector({ onPlotSelect, initialLocation }: PlotSelectorProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const [selectedPlot, setSelectedPlot] = useState<number[][]>([])

  useEffect(() => {
    if (!mapContainer.current) return

    // Initialize Mapbox
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
    
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: initialLocation || [144.9631, -37.8136], // Melbourne default
      zoom: 15
    })

    // Add drawing controls
    map.current.on('load', () => {
      // Add source for plot selection
      map.current?.addSource('plot-selection', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      })

      // Add layer for plot visualization
      map.current?.addLayer({
        id: 'plot-fill',
        type: 'fill',
        source: 'plot-selection',
        paint: {
          'fill-color': '#3b82f6',
          'fill-opacity': 0.3
        }
      })

      map.current?.addLayer({
        id: 'plot-outline',
        type: 'line',
        source: 'plot-selection',
        paint: {
          'line-color': '#3b82f6',
          'line-width': 2
        }
      })
    })

    // Handle plot selection clicks
    const points: number[][] = []
    
    map.current.on('click', (e) => {
      const coords = [e.lngLat.lng, e.lngLat.lat]
      points.push(coords)

      // Add marker for each point
      new mapboxgl.Marker({ color: '#3b82f6' })
        .setLngLat([coords[0], coords[1]])
        .addTo(map.current!)

      // If we have at least 3 points, create a polygon
      if (points.length >= 3) {
        const closedPoints = [...points, points[0]] // Close the polygon
        
        const polygon = {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [closedPoints]
          },
          properties: {}
        }

        // Update the map
        const source = map.current?.getSource('plot-selection') as mapboxgl.GeoJSONSource
        source?.setData({
          type: 'FeatureCollection',
          features: [polygon]
        })

        // Calculate area (rough approximation)
        const area = calculatePolygonArea(points)
        setSelectedPlot(points)
        onPlotSelect(points, area)
      }
    })

    return () => {
      map.current?.remove()
    }
  }, [initialLocation, onPlotSelect])

  const clearSelection = () => {
    setSelectedPlot([])
    const source = map.current?.getSource('plot-selection') as mapboxgl.GeoJSONSource
    source?.setData({
      type: 'FeatureCollection',
      features: []
    })
  }

  return (
    <div className="relative">
      <div ref={mapContainer} className="w-full h-96 rounded-lg" />
      
      {selectedPlot.length > 0 && (
        <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium">Plot Selected</p>
          <p className="text-xs text-gray-600">
            {selectedPlot.length} points, ~{calculatePolygonArea(selectedPlot).toFixed(0)} m²
          </p>
          <button
            onClick={clearSelection}
            className="mt-2 text-xs bg-red-500 text-white px-2 py-1 rounded"
          >
            Clear
          </button>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 bg-white p-2 rounded-lg shadow-lg">
        <p className="text-xs text-gray-600">
          Click to select plot boundaries
        </p>
      </div>
    </div>
  )
}

function calculatePolygonArea(coordinates: number[][]): number {
  // Simple area calculation using shoelace formula
  // This is a rough approximation for display purposes
  if (coordinates.length < 3) return 0
  
  let area = 0
  const n = coordinates.length
  
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += coordinates[i][0] * coordinates[j][1]
    area -= coordinates[j][0] * coordinates[i][1]
  }
  
  // Convert to approximate square meters (very rough)
  return Math.abs(area) * 111000 * 111000 / 2
}