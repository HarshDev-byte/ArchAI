"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { ProfileInsert } from "@/types/database"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FormField } from "@/components/ui/form-field"
import toast from "react-hot-toast"

// ── Google icon (same as login) ──────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function OrDivider() {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-white/8" />
      <span className="text-xs font-medium text-white/30 uppercase tracking-wider">or</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  )
}

// ── Password strength indicator ───────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const strength = checks.filter(Boolean).length

  const labels = ["", "Weak", "Fair", "Good", "Strong"]
  const colors = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-green-500"]

  if (!password) return null

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= strength ? colors[strength] : "bg-white/10"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-white/40">{labels[strength]} password</p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Form state
// ────────────────────────────────────────────────────────────

interface FormValues {
  fullName: string
  companyName: string
  email: string
  password: string
}

interface FormErrors {
  fullName?: string
  companyName?: string
  email?: string
  password?: string
  global?: string
}

export default function RegisterPage() {
  const router = useRouter()
  const supabase = createClient()

  const [values, setValues] = useState<FormValues>({
    fullName: "",
    companyName: "",
    email: "",
    password: "",
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  function set(field: keyof FormValues) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }))
  }

  // ── Client-side validation ─────────────────────────────────
  function validate(): boolean {
    const errs: FormErrors = {}
    if (!values.fullName.trim()) errs.fullName = "Full name is required."
    else if (values.fullName.trim().length < 2) errs.fullName = "Name must be at least 2 characters."
    if (!values.email.trim()) errs.email = "Email is required."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errs.email = "Enter a valid email address."
    if (!values.password) errs.password = "Password is required."
    else if (values.password.length < 8) errs.password = "Password must be at least 8 characters."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Email / password sign-up ───────────────────────────────
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.fullName.trim(),
          company_name: values.companyName.trim() || null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setErrors({ global: error.message })
      setIsLoading(false)
      return
    }

    // Supabase auto-creates the profile via the DB trigger.
    // If the trigger isn't deployed yet, upsert manually:
    if (data.user) {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          full_name: values.fullName.trim(),
          company_name: values.companyName.trim() || null,
        } as any, // Type assertion to bypass Supabase type issues
        { onConflict: "id", ignoreDuplicates: true }
      )
    }

    toast.success("Account created! Welcome to DesignAI 🎉")
    router.push("/dashboard")
    router.refresh()
  }

  // ── Google OAuth ───────────────────────────────────────────
  async function handleGoogleRegister() {
    setIsGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    })
    if (error) {
      toast.error(error.message)
      setIsGoogleLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Start with 5 free designs. No credit card required.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Global error */}
        {errors.global && (
          <div
            role="alert"
            className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
          >
            {errors.global}
          </div>
        )}

        {/* Google OAuth */}
        <Button
          id="btn-google-register"
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleGoogleRegister}
          isLoading={isGoogleLoading}
        >
          {!isGoogleLoading && <GoogleIcon />}
          Continue with Google
        </Button>

        <OrDivider />

        {/* Registration form */}
        <form
          id="form-register"
          onSubmit={handleRegister}
          className="space-y-4"
          noValidate
        >
          {/* Row: Full name + Company */}
          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Full name"
              htmlFor="reg-full-name"
              error={errors.fullName}
              className="col-span-2 sm:col-span-1"
            >
              <Input
                id="reg-full-name"
                type="text"
                placeholder="Arjun Sharma"
                autoComplete="name"
                value={values.fullName}
                onChange={set("fullName")}
                error={errors.fullName}
                disabled={isLoading}
              />
            </FormField>

            <FormField
              label="Company (optional)"
              htmlFor="reg-company"
              className="col-span-2 sm:col-span-1"
            >
              <Input
                id="reg-company"
                type="text"
                placeholder="Acme Builders"
                autoComplete="organization"
                value={values.companyName}
                onChange={set("companyName")}
                disabled={isLoading}
              />
            </FormField>
          </div>

          <FormField label="Email address" htmlFor="reg-email" error={errors.email}>
            <Input
              id="reg-email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              value={values.email}
              onChange={set("email")}
              error={errors.email}
              disabled={isLoading}
            />
          </FormField>

          <FormField label="Password" htmlFor="reg-password" error={errors.password}>
            <Input
              id="reg-password"
              type="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              value={values.password}
              onChange={set("password")}
              error={errors.password}
              disabled={isLoading}
            />
            <PasswordStrength password={values.password} />
          </FormField>

          {/* Terms */}
          <p className="text-xs text-white/35 leading-relaxed">
            By creating an account you agree to our{" "}
            <Link href="/terms" className="text-[#7F77DD] hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="text-[#7F77DD] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <Button
            id="btn-create-account"
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Create free account
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-white/40">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[#7F77DD] hover:text-[#9990e8] transition-colors"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
