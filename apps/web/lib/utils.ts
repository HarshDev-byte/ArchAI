import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes — the canonical shadcn/ui helper.
 * Combines clsx (conditional classes) with tailwind-merge (dedup conflicts).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number as m² or ha depending on size.
 */
export function formatArea(sqm: number): string {
  if (sqm >= 10_000) {
    return `${(sqm / 10_000).toFixed(2)} ha`;
  }
  return `${sqm.toFixed(1)} m²`;
}

/**
 * Clamp a number between min and max.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Delay helper for async flows.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
