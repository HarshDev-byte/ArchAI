"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/use-user"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LogOut, Bell, ChevronDown } from "lucide-react"
import { useState } from "react"
import type { PlanType } from "@/types/database"
import { cn } from "@/lib/utils"

// ── Plan badge variant map ────────────────────────────────────
const planVariant: Record<PlanType, "starter" | "pro" | "enterprise"> = {
  starter: "starter",
  pro: "pro",
  enterprise: "enterprise",
}

const planLabel: Record<PlanType, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
}

// ── Avatar initials ───────────────────────────────────────────
function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")
}

// ────────────────────────────────────────────────────────────
// Navbar
// ────────────────────────────────────────────────────────────

export function Navbar() {
  const { user, profile, isLoading } = useUser()
  const router = useRouter()
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)

  const remaining =
    profile ? Math.max(0, profile.designs_limit - profile.designs_used) : null
  const plan = profile?.plan ?? "starter"

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center border-b border-white/6 bg-[#0d0f14]/80 backdrop-blur-xl px-6 gap-4">
      {/* ── Brand ── */}
      <Link href="/dashboard" className="flex items-center gap-2 mr-4 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7F77DD] shadow-md shadow-[#7F77DD]/30">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <span className="text-base font-semibold tracking-tight text-white hidden sm:block">
          Design<span className="text-[#7F77DD]">AI</span>
        </span>
      </Link>

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Designs remaining pill ── */}
      {!isLoading && remaining !== null && (
        <div className="hidden md:flex items-center gap-2 rounded-full border border-white/8 bg-white/4 px-3 py-1.5">
          <span className="text-xs text-white/40">Designs</span>
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              remaining <= 1 ? "text-orange-400" : "text-white"
            )}
          >
            {remaining}/{profile?.designs_limit}
          </span>
        </div>
      )}

      {/* ── Notification bell ── */}
      <button
        aria-label="Notifications"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-white/40 hover:bg-white/6 hover:text-white transition-colors"
      >
        <Bell size={16} />
      </button>

      {/* ── User menu ── */}
      <div className="relative">
        <button
          id="nav-user-menu"
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 hover:bg-white/6 transition-colors"
          aria-expanded={menuOpen}
          aria-haspopup="true"
        >
          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#7F77DD] to-[#5b53b8] text-xs font-semibold text-white shadow-sm shrink-0">
            {isLoading ? "…" : getInitials(profile?.full_name ?? user?.email)}
          </div>

          {/* Name + plan (desktop only) */}
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium text-white truncate max-w-[120px]">
              {isLoading ? "Loading…" : (profile?.full_name ?? user?.email?.split("@")[0])}
            </span>
            <Badge variant={planVariant[plan]} className="mt-0.5">
              {planLabel[plan]}
            </Badge>
          </div>

          <ChevronDown
            size={14}
            className={cn(
              "text-white/40 transition-transform duration-200",
              menuOpen && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div className="absolute right-0 top-full mt-2 z-20 w-52 rounded-xl border border-white/10 bg-[#15181f] shadow-2xl shadow-black/50 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name ?? "Your Account"}
                </p>
                <p className="text-xs text-white/40 truncate mt-0.5">{user?.email}</p>
              </div>
              <div className="p-1">
                <Link
                  href="/dashboard/settings"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/6 hover:text-white transition-colors"
                >
                  Settings
                </Link>
                <button
                  id="nav-signout"
                  onClick={handleSignOut}
                  className="flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  )
}
