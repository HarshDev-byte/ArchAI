"use client";

import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";

/**
 * Holds a stable ref to the Mapbox map instance.
 * Components can call `mapRef.current` to access the map imperatively
 * without triggering re-renders.
 */
export function useMapRef() {
  return useRef<MapboxMap | null>(null);
}
