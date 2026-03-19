import { cn } from "@/lib/utils";
import React from "react";

/**
 * Skeleton shimmer block — drop-in replacement for loading states.
 * Usage: <Skeleton className="h-8 w-32 rounded-xl" />
 */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg bg-white/5",
        className,
      )}
      style={style}
    />
  );
}

/** Row of skeletons for a table or list */
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-3 p-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-5 flex-1"
          style={{ opacity: 1 - i * 0.15 } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/** Card-shaped skeleton */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/6 bg-[#111318] p-5 space-y-3",
        className,
      )}
    >
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3.5 w-full" />
      <Skeleton className="h-3.5 w-4/5" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

/** Projects grid skeleton */
export function ProjectGridSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

/** Results page skeleton */
export function ResultsPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      
      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-6">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-48" />
        </div>
        
        {/* Right column */}
        <div className="space-y-6">
          <SkeletonCard className="h-80" />
          <SkeletonCard className="h-32" />
        </div>
      </div>
    </div>
  );
}

/** Layout selector skeleton */
export function LayoutSelectorSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-24 rounded-lg" />
        ))}
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/** 3D viewer skeleton */
export function ThreeDViewerSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-white/2 rounded-xl border border-white/6">
      <div className="flex flex-col items-center gap-3 opacity-50">
        <div className="relative">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="absolute inset-0 rounded-full border-2 border-[#7F77DD] border-t-transparent animate-spin" />
        </div>
        <div className="text-center space-y-1">
          <Skeleton className="h-4 w-32 mx-auto" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}
