"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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

// ── Google icon ──────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}

// ── Divider ──────────────────────────────────────────────────
function OrDivider() {
  return (
    <div className="relative flex items-center gap-3 py-1">
      <div className="flex-1 h-px bg-white/8" />
      <span className="text-xs font-medium text-white/30 uppercase tracking-wider">
        or
      </span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; password?: string; global?: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)

  // ── Validation ─────────────────────────────────────────────
  function validate() {
    const errs: typeof errors = {}
    if (!email.trim()) errs.email = "Email is required."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = "Enter a valid email."
    if (!password) errs.password = "Password is required."
    else if (password.length < 6) errs.password = "Password must be at least 6 characters."
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  // ── Email / Password sign-in ───────────────────────────────
  async function handleEmailLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    setErrors({})

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setErrors({ global: error.message })
      setIsLoading(false)
      return
    }

    toast.success("Welcome back!")
    router.push("/dashboard")
    router.refresh()
  }

  // ── Google OAuth ───────────────────────────────────────────
  async function handleGoogleLogin() {
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
    // If no error, user is redirected to Google — no need to setIsLoading(false)
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>
          Sign in to your DesignAI account to continue.
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
          id="btn-google-login"
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={handleGoogleLogin}
          isLoading={isGoogleLoading}
        >
          {!isGoogleLoading && <GoogleIcon />}
          Continue with Google
        </Button>

        <OrDivider />

        {/* Email / password form */}
        <form id="form-email-login" onSubmit={handleEmailLogin} className="space-y-4" noValidate>
          <FormField label="Email address" htmlFor="login-email" error={errors.email}>
            <Input
              id="login-email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              disabled={isLoading}
            />
          </FormField>

          <FormField label="Password" htmlFor="login-password" error={errors.password}>
            <Input
              id="login-password"
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={isLoading}
            />
          </FormField>

          <div className="flex items-center justify-end">
            <Link
              href="/forgot-password"
              className="text-sm text-[#7F77DD] hover:text-[#9990e8] transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            id="btn-email-login"
            type="submit"
            size="lg"
            className="w-full"
            isLoading={isLoading}
          >
            Sign in
          </Button>
        </form>

        {/* Footer */}
        <p className="text-center text-sm text-white/40">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-[#7F77DD] hover:text-[#9990e8] transition-colors"
          >
            Create one free
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
