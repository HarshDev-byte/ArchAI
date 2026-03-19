"use client"

import { useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { CheckIcon, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  useNewProjectStore,
  useWizardStep,
  useStep1Valid,
  useStep2Valid,
  WIZARD_STEPS,
  type WizardStep,
} from "@/store/new-project"
import { Button } from "@/components/ui/button"
import { PlotMap } from "@/components/map/PlotMap"
import { ProjectDetailsForm } from "@/components/project/ProjectDetailsForm"
import { RequirementsForm } from "@/components/project/RequirementsForm"
import { ReviewPanel } from "@/components/project/ReviewPanel"
import { Suspense } from "react"

// ─────────────────────────────────────────────────────────────
// Step validity
// ─────────────────────────────────────────────────────────────

function useStepValidity(): Record<WizardStep, boolean> {
  const step1 = useStep1Valid()
  const step2 = useStep2Valid()
  return { 1: step1, 2: step2, 3: true, 4: true }
}

// ─────────────────────────────────────────────────────────────
// Framer Motion page variants
// ─────────────────────────────────────────────────────────────

const pageVariants = {
  enter: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? 48 : -48,
  }),
  center: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir > 0 ? -48 : 48,
    transition: { duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] as const },
  }),
}

// ─────────────────────────────────────────────────────────────
// Progress bar
// ─────────────────────────────────────────────────────────────

function WizardProgress({
  onStepClick,
}: {
  onStepClick: (step: WizardStep, direction: number) => void
}) {
  const currentStep = useWizardStep()
  const validity = useStepValidity()

  return (
    <div className="w-full px-6 py-4 border-b border-white/6 bg-[#0d0f14]/80 backdrop-blur-sm shrink-0">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center">
          {WIZARD_STEPS.map(({ step, label }, idx) => {
            const isCompleted = step < currentStep
            const isCurrent   = step === currentStep
            const canClick    = isCompleted || (step === currentStep + 1 && validity[currentStep])

            return (
              <div key={step} className="flex flex-1 items-center">
                {/* Node */}
                <button
                  onClick={() => canClick && onStepClick(step as WizardStep, step > currentStep ? 1 : -1)}
                  disabled={!canClick && !isCurrent}
                  className={cn(
                    "flex flex-col items-center gap-1 transition-all duration-200 shrink-0",
                    (canClick || isCompleted) && "cursor-pointer"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300",
                      isCompleted && "border-[#7F77DD] bg-[#7F77DD] text-white",
                      isCurrent  && "border-[#7F77DD] bg-[#7F77DD]/15 text-[#7F77DD] shadow-[0_0_14px_#7F77DD40]",
                      !isCompleted && !isCurrent && "border-white/15 bg-white/3 text-white/30"
                    )}
                  >
                    {isCompleted
                      ? <CheckIcon size={13} strokeWidth={2.5} />
                      : step}
                  </div>
                  <span
                    className={cn(
                      "hidden sm:block text-[10px] font-medium whitespace-nowrap transition-colors",
                      isCurrent   ? "text-white"        :
                      isCompleted ? "text-[#7F77DD]"    : "text-white/30"
                    )}
                  >
                    {label}
                  </span>
                </button>

                {/* Connector */}
                {idx < WIZARD_STEPS.length - 1 && (
                  <div className="flex-1 mx-2 mb-3 sm:mb-4">
                    <div className="h-px w-full overflow-hidden rounded-full bg-white/8">
                      <motion.div
                        className="h-full rounded-full bg-[#7F77DD]"
                        animate={{ width: step < currentStep ? "100%" : "0%" }}
                        transition={{ duration: 0.5, ease: "easeInOut" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// (ReviewPanel handles the full Step 4 UI and generation flow)

// ─────────────────────────────────────────────────────────────
// Main Wizard Page
// ─────────────────────────────────────────────────────────────

export default function NewProjectPage() {
  const currentStep = useWizardStep()
  const { nextStep, prevStep, setStep } = useNewProjectStore()
  const validity = useStepValidity()

  // Track animation direction: 1 = forward (slide right-to-left), -1 = backward
  const [direction, setDirection] = useState(1)

  function goNext() {
    setDirection(1)
    nextStep()
  }

  function goBack() {
    setDirection(-1)
    prevStep()
  }

  function goToStep(step: WizardStep, dir: number) {
    setDirection(dir)
    setStep(step)
  }

  const canProceed = validity[currentStep]

  const stepDescriptions: Record<WizardStep, string> = {
    1: "Draw your land parcel on the satellite map, or enter dimensions manually",
    2: "Define project name, type, floors, style, budget tier, and target market",
    3: "Specify your unit mix, facilities programme, and any special constraints",
    4: "Review all inputs — then generate your AI feasibility analysis",
  }

  return (
    <div className="flex flex-col h-full -mx-6 -mt-8 -mb-8 lg:-mx-8 overflow-hidden">

      {/* ── Progress bar ── */}
      <WizardProgress onStepClick={goToStep} />

      {/* ── Step description ── */}
      <div className="px-6 pt-4 pb-3 border-b border-white/5 shrink-0">
        <p className="text-xs text-white/35 max-w-3xl mx-auto">{stepDescriptions[currentStep]}</p>
      </div>

      {/* ── Step content (animated) ── */}
      <div
        className={cn(
          "flex-1 min-h-0",
          currentStep === 1 ? "relative overflow-hidden" : "overflow-y-auto"
        )}
      >
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={pageVariants}
            initial="enter"
            animate="center"
            exit="exit"
            className={cn(
              "h-full",
              currentStep === 1
                ? "absolute inset-0"
                : "px-6 py-6 lg:px-8"
            )}
          >
            {currentStep === 1 && (
              <Suspense fallback={
                <div className="flex h-full items-center justify-center text-white/30 text-sm">
                  Loading map…
                </div>
              }>
                <PlotMap />
              </Suspense>
            )}

            {currentStep === 2 && <ProjectDetailsForm />}
            {currentStep === 3 && <RequirementsForm />}
            {currentStep === 4 && <ReviewPanel />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer nav (hidden on step 1 and step 4 — both have their own CTAs) ── */}
      {currentStep !== 1 && currentStep !== 4 && (
        <div className="flex items-center justify-between border-t border-white/6 px-6 py-4 bg-[#0d0f14]/80 backdrop-blur-sm shrink-0">
          <Button
            variant="ghost"
            onClick={goBack}
            className="gap-1"
          >
            <ChevronLeft size={15} />
            {currentStep === 2 ? "Back to map" : "Back"}
          </Button>

          <div className="flex items-center gap-3">
            {/* Optional skip for step 3 */}
            {currentStep === 3 && (
              <Button
                variant="ghost"
                onClick={goNext}
                className="text-white/40 hover:text-white/70 text-sm"
              >
                Skip for now
              </Button>
            )}

            <Button
              id={`wizard-step-${currentStep}-next`}
              disabled={!canProceed}
              onClick={goNext}
              className="gap-1"
            >
              Continue <ChevronRight size={15} />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
