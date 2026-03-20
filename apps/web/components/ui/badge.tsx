import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default:     "bg-[#7F77DD]/15 text-[#7F77DD] border border-[#7F77DD]/25",
        secondary:   "bg-blue-500/15 text-blue-400 border border-blue-500/20",
        destructive: "bg-red-500/15 text-red-400 border border-red-500/20",
        outline:     "bg-white/8 text-white/50 border border-white/10",
        // Legacy variants for backward compatibility
        draft:       "bg-white/8 text-white/50 border border-white/10",
        feasibility: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20",
        layouts:     "bg-blue-500/15 text-blue-400 border border-blue-500/20",
        exported:    "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20",
        starter:     "bg-zinc-700/60 text-zinc-300 border border-zinc-600/40",
        pro:         "bg-[#7F77DD]/20 text-[#9990e8] border border-[#7F77DD]/30",
        enterprise:  "bg-amber-500/15 text-amber-400 border border-amber-500/20",
        warning:     "bg-orange-500/15 text-orange-400 border border-orange-500/20",
        error:       "bg-red-500/15 text-red-400 border border-red-500/20",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full bg-current opacity-80"
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}

export { Badge, badgeVariants }
