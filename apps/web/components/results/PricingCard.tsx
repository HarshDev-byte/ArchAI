"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatInrCrore } from "@/lib/format"

interface LayoutData {
  id: string
  concept_name: string
  total_units: number
  estimated_cost_inr: number
  estimated_revenue_inr: number
  roi_pct: number
}

interface PricingCardProps {
  selectedLayout: LayoutData | null
}

const COST_BREAKDOWN = [
  { name: "Foundation", percentage: 15, color: "#8B5CF6" },
  { name: "Structure", percentage: 35, color: "#7F77DD" },
  { name: "Finishing", percentage: 28, color: "#60A5FA" },
  { name: "MEP", percentage: 12, color: "#34D399" },
  { name: "Misc", percentage: 10, color: "#F59E0B" },
]

export function PricingCard({ selectedLayout }: PricingCardProps) {
  if (!selectedLayout) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/60 text-center py-8">
            Select a layout to view cost breakdown
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalCost = selectedLayout.estimated_cost_inr
  const totalRevenue = selectedLayout.estimated_revenue_inr
  const grossProfit = totalRevenue - totalCost
  const marginPercent = (grossProfit / totalRevenue) * 100
  const breakEvenMonths = Math.ceil(totalCost / (totalRevenue / selectedLayout.total_units))

  // Calculate actual cost values for each category
  const costData = COST_BREAKDOWN.map(item => ({
    ...item,
    value: (totalCost * item.percentage) / 100,
    formattedValue: formatInrCrore((totalCost * item.percentage) / 100)
  }))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-[#1a1b23] border border-white/20 rounded-lg p-3 shadow-lg">
          <p className="text-white font-medium">{data.name}</p>
          <p className="text-[#7F77DD]">{data.formattedValue}</p>
          <p className="text-white/60 text-sm">{data.percentage}% of total</p>
        </div>
      )
    }
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost Breakdown</CardTitle>
        <p className="text-sm text-white/60">{selectedLayout.concept_name}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Pie Chart */}
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={costData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {costData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          {costData.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-sm" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-white/80">{item.name}</span>
              <span className="text-white/60 ml-auto">{item.percentage}%</span>
            </div>
          ))}
        </div>

        {/* Financial Summary */}
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex justify-between items-center">
            <span className="text-white/60">Total construction cost</span>
            <span className="font-semibold text-white">{formatInrCrore(totalCost)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-white/60">Estimated revenue</span>
            <span className="font-semibold text-white">{formatInrCrore(totalRevenue)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-white/60">Gross profit</span>
            <span className="font-semibold text-green-400">{formatInrCrore(grossProfit)}</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-white/60">Margin %</span>
            <span className="font-semibold text-white">{marginPercent.toFixed(1)}%</span>
          </div>
          
          <div className="flex justify-between items-center pt-2 border-t border-white/10">
            <span className="text-white/60">Break-even</span>
            <span className="font-semibold text-white">
              ~{breakEvenMonths} months at full occupancy
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}