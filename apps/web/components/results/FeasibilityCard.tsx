"use client"

import { useRouter } from "next/navigation"
import { CheckCircle, XCircle, AlertTriangle, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatSetback, translateRejectionReason, capitalize } from "@/lib/format"
import { cn } from "@/lib/utils"

interface FeasibilityData {
  feasible: boolean
  confidence: "high" | "medium" | "low"
  rejection_reasons?: string[]
  warnings?: string[]
  approved_config?: {
    max_floors: number
    recommended_floors: number
    max_fsi: number
    usable_area_sqft: number
    floor_plate_sqft: number
    setbacks: {
      front_ft: number
      rear_ft: number
      side_ft: number
    }
    parking_type: string
  }
  regulatory_notes?: string
  nearby_advantages?: string[]
}

interface FeasibilityCardProps {
  feasibility: FeasibilityData
  plotArea?: number
  projectId: string
}

export function FeasibilityCard({ feasibility, plotArea, projectId }: FeasibilityCardProps) {
  const router = useRouter()

  if (feasibility.feasible) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle size={20} className="text-green-400" />
            <CardTitle className="text-green-400">Plot approved for development</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats Grid */}
          {feasibility.approved_config && (
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white/60 mb-1">Recommended floors</p>
                <p className="text-lg font-semibold text-white">
                  {feasibility.approved_config.recommended_floors}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white/60 mb-1">Usable area</p>
                <p className="text-lg font-semibold text-white">
                  {Math.round(feasibility.approved_config.usable_area_sqft).toLocaleString()} sqft
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white/60 mb-1">Max FSI</p>
                <p className="text-lg font-semibold text-white">
                  {feasibility.approved_config.max_fsi}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                <p className="text-sm text-white/60 mb-1">Parking type</p>
                <p className="text-lg font-semibold text-white">
                  {capitalize(feasibility.approved_config.parking_type)}
                </p>
              </div>
            </div>
          )}

          {/* Setbacks Table */}
          {feasibility.approved_config?.setbacks && (
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3">Required Setbacks</h4>
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-white/60">Side</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-white/60">Distance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    <tr>
                      <td className="px-3 py-2 text-sm text-white/80">Front</td>
                      <td className="px-3 py-2 text-sm text-white">
                        {formatSetback(feasibility.approved_config.setbacks.front_ft)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-sm text-white/80">Rear</td>
                      <td className="px-3 py-2 text-sm text-white">
                        {formatSetback(feasibility.approved_config.setbacks.rear_ft)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-sm text-white/80">Side</td>
                      <td className="px-3 py-2 text-sm text-white">
                        {formatSetback(feasibility.approved_config.setbacks.side_ft)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Warnings */}
          {feasibility.warnings && feasibility.warnings.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3">Warnings</h4>
              <div className="space-y-2">
                {feasibility.warnings.map((warning, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20"
                  >
                    <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-yellow-200">{warning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Nearby Advantages */}
          {feasibility.nearby_advantages && feasibility.nearby_advantages.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-white/80 mb-3">Location Advantages</h4>
              <div className="flex flex-wrap gap-2">
                {feasibility.nearby_advantages.map((advantage, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="bg-green-500/10 text-green-400 border-green-500/20"
                  >
                    <MapPin size={12} className="mr-1" />
                    {advantage}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Regulatory Notes */}
          {feasibility.regulatory_notes && (
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-200">{feasibility.regulatory_notes}</p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Not feasible
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <XCircle size={20} className="text-red-400" />
          <CardTitle className="text-red-400">This configuration isn't possible</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rejection Reasons */}
        {feasibility.rejection_reasons && feasibility.rejection_reasons.length > 0 && (
          <div className="space-y-3">
            {feasibility.rejection_reasons.map((reason, index) => (
              <div
                key={index}
                className="p-4 rounded-lg bg-red-500/10 border-l-4 border-red-500"
              >
                <p className="text-sm text-red-200">
                  {translateRejectionReason(reason, plotArea)}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push(`/dashboard/projects/new?project=${projectId}&step=3`)}
          >
            Modify requirements →
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push(`/dashboard/projects/new?project=${projectId}&step=1`)}
          >
            Try a different plot →
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}