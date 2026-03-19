"use client";

import { useEffect, useState } from "react";

/**
 * Returns true only after the component has mounted on the client.
 * Use this to avoid hydration mismatches for client-only libraries like
 * Mapbox GL and Three.js.
 */
export function useIsMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
