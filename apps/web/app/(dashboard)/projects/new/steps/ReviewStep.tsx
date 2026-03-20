"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useNewProjectStore } from "@/store/new-project"
import { useUser } from "@/hooks/use-user"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  MapPin, 
  Ruler, 
  Building, 
  Layers3, 
  Palette, 
  DollarSign,
  Home,
  Sparkles,
  ArrowRight,
  Loader2
} from "lucide-react"

// ─────────────────────────────────────────────────────────────
// Plot Summary
// ─────────────────────────────────────────────────────────────

function PlotSummary() {
  const { plot } = useNewProjectStore()

  if (!plot.plotAreaSqft && !plot.isManualEntry) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin size={20} />
            Plot Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-white/60">No plot information available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin size={20} />
          Plot Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Location */}
        {plot.locality && (
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-[#7F77DD]" />
            <span className="text-white/80">
              {plot.locality}
              {plot.locationCity && `, ${plot.locationCity}`}
            </span>
          </div>
        )}

        {/* Coordinates */}
        {plot.locationLat && plot.locationLng && (
          <div className="text-sm text-white/60">
            Coordinates: {plot.locationLat.toFixed(6)}, {plot.locationLng.toFixed(6)}
          </div>
        )}

        {/* Area metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg bg-white/5">
            <p className="text-lg font-bold text-white">
              {plot.plotAreaSqft?.toFixed(0) || "—"}
            </p>
            <p className="text-xs text-white/60">sq ft</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/5">
            <p className="text-lg font-bold text-white">
              {plot.plotAreaSqm?.toFixed(1) || "—"}
            </p>
            <p className="text-xs text-white/60">sq m</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/5">
            <p className="text-lg font-bold text-white">
              {plot.plotAreaCents?.toFixed(2) || "—"}
            </p>
            <p className="text-xs text-white/60">cents</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-white/5">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Ruler size={12} className="text-white/40" />
            </div>
            <p className="text-sm font-semibold text-white">
              {plot.plotLengthFt?.toFixed(0) || "—"} × {plot.plotWidthFt?.toFixed(0) || "—"}
            </p>
            <p className="text-xs text-white/60">L × W ft</p>
          </div>
        </div>

        {/* Entry method */}
        <div className="text-sm text-white/60">
          {plot.isManualEntry ? "Entered manually" : "Drawn on map"}
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Project Details Summary
// ─────────────────────────────────────────────────────────────

function ProjectDetailsSummary() {
  const { 
    projectName, 
    projectType, 
    floorsRequested, 
    projectStyle, 
    budgetTier 
  } = useNewProjectStore()

  const typeLabels = {
    apartment: "Apartment Complex",
    bungalow: "Bungalow",
    villa: "Villa",
    mixed_use: "Mixed Use Development",
    township: "Township"
  }

  const styleLabels = {
    modern: "Modern",
    contemporary: "Contemporary", 
    traditional: "Traditional",
    luxury: "Luxury"
  }

  const budgetLabels = {
    budget: "Budget",
    mid_range: "Mid-range",
    premium: "Premium",
    ultra_luxury: "Ultra Luxury"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building size={20} />
          Project Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-white/60 mb-1">Project Name</p>
            <p className="font-semibold text-white">{projectName || "Untitled Project"}</p>
          </div>
          
          <div>
            <p className="text-sm text-white/60 mb-1">Type</p>
            <p className="font-semibold text-white">
              {projectType ? typeLabels[projectType] : "Not selected"}
            </p>
          </div>
          
          <div>
            <p className="text-sm text-white/60 mb-1">Floors</p>
            <div className="flex items-center gap-2">
              <Layers3 size={16} className="text-[#7F77DD]" />
              <p className="font-semibold text-white">{floorsRequested}</p>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-white/60 mb-1">Style</p>
            <div className="flex items-center gap-2">
              <Palette size={16} className="text-[#7F77DD]" />
              <p className="font-semibold text-white">
                {projectStyle ? styleLabels[projectStyle] : "Not selected"}
              </p>
            </div>
          </div>
          
          <div className="lg:col-span-2">
            <p className="text-sm text-white/60 mb-1">Budget Tier</p>
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-[#7F77DD]" />
              <p className="font-semibold text-white">
                {budgetTier ? budgetLabels[budgetTier] : "Not selected"}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Requirements Summary
// ─────────────────────────────────────────────────────────────

function RequirementsSummary() {
  const { unitMix, amenities, specialNotes } = useNewProjectStore()

  const enabledUnits = unitMix.filter(u => u.enabled && u.count > 0)
  const totalUnits = enabledUnits.reduce((sum, u) => sum + u.count, 0)

  const unitLabels = {
    studio: "Studio",
    "1bhk": "1 BHK",
    "2bhk": "2 BHK", 
    "3bhk": "3 BHK",
    "4bhk_plus": "4+ BHK"
  }

  const amenityLabels: Record<string, string> = {
    pool: "Swimming Pool",
    podium_parking: "Podium Parking",
    basement_parking: "Basement Parking",
    gym: "Gymnasium",
    clubhouse: "Clubhouse",
    kids_play: "Kids Play Area",
    garden: "Landscaped Garden",
    retail: "Ground Floor Retail",
    rooftop: "Rooftop Amenities",
    solar: "Solar Panels",
    ev_charging: "EV Charging"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home size={20} />
          Requirements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unit Mix */}
        <div>
          <p className="text-sm text-white/60 mb-2">Unit Mix ({totalUnits} total units)</p>
          {enabledUnits.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {enabledUnits.map(unit => (
                <div key={unit.type} className="flex justify-between items-center p-2 rounded bg-white/5">
                  <span className="text-sm text-white/80">{unitLabels[unit.type]}</span>
                  <span className="font-semibold text-white">{unit.count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/60">No units selected</p>
          )}
        </div>

        {/* Amenities */}
        <div>
          <p className="text-sm text-white/60 mb-2">Amenities ({amenities.length} selected)</p>
          {amenities.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {amenities.map(amenityId => (
                <span 
                  key={amenityId}
                  className="px-2 py-1 rounded-full bg-[#7F77DD]/20 text-xs text-[#7F77DD] border border-[#7F77DD]/30"
                >
                  {amenityLabels[amenityId] || amenityId}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-white/60">No amenities selected</p>
          )}
        </div>

        {/* Special Notes */}
        {specialNotes && (
          <div>
            <p className="text-sm text-white/60 mb-2">Special Requirements</p>
            <p className="text-sm text-white/80 bg-white/5 p-3 rounded-lg">
              {specialNotes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────
// Generation Button
// ─────────────────────────────────────────────────────────────

function GenerateButton() {
  const router = useRouter()
  const { user } = useUser()
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationStep, setGenerationStep] = useState("")

  const handleGenerate = async () => {
    if (!user) {
      router.push("/login")
      return
    }

    setIsGenerating(true)
    
    try {
      // Simulate the generation process with steps
      setGenerationStep("Analyzing plot...")
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setGenerationStep("Checking regulations...")
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      setGenerationStep("Generating layouts...")
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // TODO: Implement actual API calls
      // 1. POST /api/v1/projects
      // 2. POST /api/v1/feasibility/check  
      // 3. Open WebSocket /ws/{job_id}
      
      // For now, redirect to a mock results page
      router.push("/dashboard/projects/mock-id/results")
      
    } catch (error) {
      console.error("Generation failed:", error)
      setIsGenerating(false)
      setGenerationStep("")
    }
  }

  return (
    <div className="text-center space-y-4">
      <Button
        size="xl"
        onClick={handleGenerate}
        disabled={isGenerating}
        className="gap-3 px-8"
      >
        {isGenerating ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            {generationStep || "Generating..."}
          </>
        ) : (
          <>
            <Sparkles size={20} />
            Generate Feasibility + Layouts
            <ArrowRight size={20} />
          </>
        )}
      </Button>
      
      {isGenerating && (
        <div className="max-w-md mx-auto">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#7F77DD] to-[#9990e8] rounded-full animate-pulse" />
          </div>
          <p className="text-sm text-white/60 mt-2">
            This may take 2-3 minutes. Please don't close this page.
          </p>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export function ReviewStep() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Review & Generate</h2>
        <p className="text-white/60">
          Review your project details and generate AI-powered feasibility analysis
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <PlotSummary />
          <ProjectDetailsSummary />
        </div>
        <div>
          <RequirementsSummary />
        </div>
      </div>

      {/* Generate Button */}
      <div className="pt-6 border-t border-white/8">
        <GenerateButton />
      </div>
    </div>
  )
}