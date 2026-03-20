"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useNewProjectStore, WIZARD_STEPS, type WizardStep } from "@/store/new-project"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Check } from "lucide-react"

// Step components
import { PlotStep } from "@/app/(dashboard)/projects/new/steps/PlotStep"
import { ProjectDetailsStep } from "@/app/(dashboard)/projects/new/steps/ProjectDetailsStep"
import { RequirementsStep } from "@/app/(dashboard)/projects/new/steps/RequirementsStep"
import { ReviewStep } from "@/app/(dashboard)/projects/new/steps/ReviewStep"

// ─────────────────────────────────────────────────────────────
// Progress Bar Component
// ─────────────────────────────────────────────────────────────

function ProgressBar({ currentStep }: { currentStep: WizardStep }) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isActive = step.step === currentStep
          const isCompleted = step.step < currentStep
          const isLast = index === WIZARD_STEPS.length - 1

          return (
            <div key={step.step} className="flex items-center flex-1">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all duration-300",
                    isCompleted
                      ? "bg-[#7F77DD] border-[#7F77DD] text-white"
                      : isActive
                      ? "border-[#7F77DD] text-[#7F77DD] bg-[#7F77DD]/10"
                      : "border-white/20 text-white/40"
                  )}
                >
                  {isCompleted ? (
                    <Check size={16} />
                  ) : (
                    step.step
                  )}
                </div>
                
                {/* Step label */}
                <div className="mt-2 text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      isActive || isCompleted ? "text-white" : "text-white/40"
                    )}
                  >
                    {step.label}
                  </p>
                  <p
                    className={cn(
                      "text-xs mt-0.5 hidden sm:block",
                      isActive || isCompleted ? "text-white/60" : "text-white/30"
                    )}
                  >
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-4 transition-all duration-300",
                    isCompleted ? "bg-[#7F77DD]" : "bg-white/10"
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Navigation Component
// ─────────────────────────────────────────────────────────────

function Navigation() {
  const router = useRouter()
  const { currentStep, prevStep, nextStep } = useNewProjectStore()
  
  const canGoBack = currentStep > 1
  const canGoNext = currentStep < 4
  const isLastStep = currentStep === 4

  return (
    <div className="flex items-center justify-between pt-6 border-t border-white/8">
      <Button
        variant="ghost"
        onClick={canGoBack ? prevStep : () => router.push("/dashboard")}
        className="gap-2"
      >
        <ChevronLeft size={16} />
        {canGoBack ? "Previous" : "Cancel"}
      </Button>

      {!isLastStep && (
        <Button
          onClick={nextStep}
          disabled={!canGoNext}
          className="gap-2"
        >
          Next Step
          <ChevronRight size={16} />
        </Button>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const { currentStep, reset } = useNewProjectStore()

  // Reset store on mount
  useState(() => {
    reset()
  })

  function renderStep() {
    switch (currentStep) {
      case 1:
        return <PlotStep />
      case 2:
        return <ProjectDetailsStep />
      case 3:
        return <RequirementsStep />
      case 4:
        return <ReviewStep />
      default:
        return <PlotStep />
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0b10] via-[#111318] to-[#1a1b23] p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Create New Project
          </h1>
          <p className="text-white/60">
            Design your building in minutes with AI-powered feasibility analysis
          </p>
        </div>

        {/* Progress Bar */}
        <ProgressBar currentStep={currentStep} />

        {/* Step Content */}
        <Card className="mb-6">
          <CardContent className="p-0">
            {renderStep()}
          </CardContent>
        </Card>

        {/* Navigation */}
        <Navigation />
      </div>
    </div>
  )
}