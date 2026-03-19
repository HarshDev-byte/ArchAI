import * as React from "react"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label: string
  error?: string
  children: React.ReactNode
  className?: string
  htmlFor?: string
  hint?: string
}

/**
 * Convenience wrapper: Label + Input + error message.
 * Reduces boilerplate in auth forms.
 */
export function FormField({
  label,
  error,
  children,
  className,
  htmlFor,
  hint,
}: FormFieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium text-white/70"
      >
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs text-white/35">{hint}</p>
      )}
      {error && (
        <p className="text-xs text-red-400 flex items-center gap-1">
          <svg className="h-3 w-3 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
    </div>
  )
}
