"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInrCrore, capitalize } from "@/lib/format"
import { cn } from "@/lib/utils"

interface LayoutData {
  id: string
  concept_name: string
  unit_mix: Array<{ type: string; count: number }>
  total_units: number
  estimated_cost_inr: number
  estimated_revenue_inr: number
  roi_pct: number
  footprint_shape: string
  approved_config?: {
    recommended_floors: number
    parking_type: string
  }
}

interface ComparisonTableProps {
  layouts: LayoutData[]
}

export function ComparisonTable({ layouts }: ComparisonTableProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (layouts.length === 0) {
    return null
  }

  // Helper function to get unit count by type
  const getUnitCount = (layout: LayoutData, type: string): number => {
    const unit = layout.unit_mix.find(u => u.type.toLowerCase().includes(type.toLowerCase()))
    return unit?.count || 0
  }

  // Helper function to calculate total area (rough estimate)
  const getTotalArea = (layout: LayoutData): number => {
    const avgUnitSize = 800 // Average unit size in sqft
    return layout.total_units * avgUnitSize
  }

  // Helper function to find best value in a row
  const getBestValue = (values: number[], maximize: boolean = true): number => {
    return maximize ? Math.max(...values) : Math.min(...values)
  }

  // Helper function to check if value is best
  const isBestValue = (value: number, values: number[], maximize: boolean = true): boolean => {
    const bestValue = getBestValue(values, maximize)
    return value === bestValue
  }

  const rows = [
    {
      label: "Total units",
      values: layouts.map(l => l.total_units),
      format: (v: number) => v.toString(),
      maximize: true
    },
    {
      label: "1BHK count", 
      values: layouts.map(l => getUnitCount(l, "1bhk")),
      format: (v: number) => v.toString(),
      maximize: true
    },
    {
      label: "2BHK count",
      values: layouts.map(l => getUnitCount(l, "2bhk")),
      format: (v: number) => v.toString(),
      maximize: true
    },
    {
      label: "3BHK count",
      values: layouts.map(l => getUnitCount(l, "3bhk")),
      format: (v: number) => v.toString(),
      maximize: true
    },
    {
      label: "Total area (sqft)",
      values: layouts.map(l => getTotalArea(l)),
      format: (v: number) => Math.round(v).toLocaleString(),
      maximize: true
    },
    {
      label: "Est. cost",
      values: layouts.map(l => l.estimated_cost_inr),
      format: (v: number) => formatInrCrore(v),
      maximize: false
    },
    {
      label: "Est. revenue",
      values: layouts.map(l => l.estimated_revenue_inr),
      format: (v: number) => formatInrCrore(v),
      maximize: true
    },
    {
      label: "ROI %",
      values: layouts.map(l => l.roi_pct),
      format: (v: number) => `${v.toFixed(1)}%`,
      maximize: true
    },
    {
      label: "Floors",
      values: layouts.map(l => l.approved_config?.recommended_floors || 0),
      format: (v: number) => v.toString(),
      maximize: false
    },
    {
      label: "Footprint shape",
      values: layouts.map((l, i) => i), // Use index as value for string comparison
      format: (v: number, layout: LayoutData) => capitalize(layout.footprint_shape.replace('_', '-')),
      maximize: false,
      isString: true
    },
    {
      label: "Parking type",
      values: layouts.map((l, i) => i), // Use index as value for string comparison
      format: (v: number, layout: LayoutData) => capitalize(layout.approved_config?.parking_type || ""),
      maximize: false,
      isString: true
    }
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Layout Comparison</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="gap-2"
          >
            {isExpanded ? "Hide comparison" : "Show comparison"}
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-2 text-sm font-medium text-white/60">
                    Metric
                  </th>
                  {layouts.map((layout) => (
                    <th
                      key={layout.id}
                      className="text-center py-3 px-2 text-sm font-medium text-white/60 min-w-[120px]"
                    >
                      {layout.concept_name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="py-3 px-2 text-sm text-white/80 font-medium">
                      {row.label}
                    </td>
                    {layouts.map((layout, colIndex) => {
                      const value = row.values[colIndex]
                      const isBest = !row.isString && isBestValue(value, row.values, row.maximize)
                      
                      return (
                        <td
                          key={layout.id}
                          className={cn(
                            "py-3 px-2 text-sm text-center",
                            isBest 
                              ? "bg-green-500/20 text-green-300 font-semibold" 
                              : "text-white"
                          )}
                        >
                          {row.isString 
                            ? row.format(value, layout)
                            : row.format(value)
                          }
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-xs text-white/40">
            <p>Green highlighting indicates the best value in each category.</p>
          </div>
        </CardContent>
      )}
    </Card>
  )
}