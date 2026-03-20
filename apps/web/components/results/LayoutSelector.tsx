"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatInrCrore, formatUnitMix, getRoiColor } from "@/lib/format"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api-client"

interface LayoutData {
  id: string
  concept_name: string
  design_philosophy: string
  unit_mix: Array<{ type: string; count: number }>
  total_units: number
  estimated_cost_inr: number
  estimated_revenue_inr: number
  roi_pct: number
  footprint_shape: "rectangle" | "l_shape" | "u_shape"
  strengths: string[]
  limitations: string[]
  is_selected: boolean
}

interface LayoutSelectorProps {
  layouts: LayoutData[]
  selectedLayoutId?: string
  onLayoutSelect: (layout: LayoutData) => void
}

const FOOTPRINT_LABELS = {
  rectangle: "Rectangle",
  l_shape: "L-shape", 
  u_shape: "U-shape"
}

export function LayoutSelector({ layouts, selectedLayoutId, onLayoutSelect }: LayoutSelectorProps) {
  const [selectingId, setSelectingId] = useState<string | null>(null)

  const handleSelect = async (layout: LayoutData) => {
    if (selectingId || layout.is_selected) return

    setSelectingId(layout.id)
    
    try {
      await apiClient.put(`/layouts/${layout.id}/select`)
      onLayoutSelect(layout)
    } catch (error) {
      console.error("Failed to select layout:", error)
    } finally {
      setSelectingId(null)
    }
  }

  if (layouts.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Layout Options</h3>
      <div className="space-y-4">
        {layouts.map((layout) => {
          const isSelected = layout.is_selected || layout.id === selectedLayoutId
          const isSelecting = selectingId === layout.id
          const avgUnitSize = layout.total_units > 0 ? (layout.estimated_cost_inr / layout.total_units) * 0.8 : 0 // Rough estimate

          return (
            <Card
              key={layout.id}
              className={cn(
                "relative transition-all duration-200 cursor-pointer hover:border-[#7F77DD]/50",
                isSelected && "border-[#7F77DD] border-2"
              )}
              onClick={() => handleSelect(layout)}
            >
              {/* Selected Badge */}
              {isSelected && (
                <div className="absolute -top-2 -right-2 z-10">
                  <div className="w-6 h-6 rounded-full bg-[#7F77DD] flex items-center justify-center">
                    <Check size={14} className="text-white" />
                  </div>
                </div>
              )}

              <CardHeader className="pb-3">
                {/* Header Row */}
                <div className="flex items-center justify-between">
                  <h4 className="text-base font-medium text-white">
                    {layout.concept_name}
                  </h4>
                  <Badge variant="outline" className="text-xs">
                    {FOOTPRINT_LABELS[layout.footprint_shape] || layout.footprint_shape}
                  </Badge>
                </div>

                {/* Design Philosophy */}
                <p className="text-xs text-white/60 italic truncate">
                  {layout.design_philosophy}
                </p>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Divider */}
                <div className="border-t border-white/10" />

                {/* Unit Mix Summary */}
                <div>
                  <p className="text-sm text-white/80">
                    {formatUnitMix(layout.unit_mix)}
                  </p>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-white/60">Area: </span>
                    <span className="text-white">
                      {Math.round(layout.total_units * avgUnitSize).toLocaleString()} sqft
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">Cost: </span>
                    <span className="text-white">
                      {formatInrCrore(layout.estimated_cost_inr)}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">Revenue: </span>
                    <span className="text-white">
                      {formatInrCrore(layout.estimated_revenue_inr)}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/60">ROI: </span>
                    <span className={getRoiColor(layout.roi_pct)}>
                      {layout.roi_pct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Strengths */}
                {layout.strengths && layout.strengths.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {layout.strengths.slice(0, 2).map((strength, index) => (
                      <Badge
                        key={index}
                        variant="outline"
                        className="text-xs bg-green-500/10 text-green-400 border-green-500/20"
                      >
                        {strength}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Limitation */}
                {layout.limitations && layout.limitations.length > 0 && (
                  <div>
                    <Badge
                      variant="outline"
                      className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20"
                    >
                      {layout.limitations[0]}
                    </Badge>
                  </div>
                )}

                {/* Select Button */}
                <div className="pt-2">
                  {isSelected ? (
                    <div className="w-full py-2 text-center text-sm font-medium text-[#7F77DD]">
                      Selected
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      disabled={isSelecting}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelect(layout)
                      }}
                    >
                      {isSelecting ? "Selecting..." : "Select this layout"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}