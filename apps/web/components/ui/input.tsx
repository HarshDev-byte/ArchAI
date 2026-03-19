import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-lg border bg-white/5 px-3 py-2 text-sm text-white transition-colors",
          "placeholder:text-white/30",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7F77DD] focus-visible:ring-offset-1 focus-visible:ring-offset-[#111318]",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error
            ? "border-red-500/50 focus-visible:ring-red-500"
            : "border-white/10 hover:border-white/20",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
