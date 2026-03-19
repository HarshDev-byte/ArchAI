"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderOpen,
  Map,
  FileText,
  Settings,
  HelpCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useUser } from "@/hooks/use-user"

// ── Nav items ─────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: "/dashboard",          label: "Dashboard",  icon: LayoutDashboard },
  { href: "/dashboard/projects", label: "Projects",   icon: FolderOpen },
  { href: "/dashboard/map",      label: "Draw Parcel",icon: Map },
  { href: "/dashboard/reports",  label: "Reports",    icon: FileText },
] as const

const NAV_BOTTOM = [
  { href: "/dashboard/settings", label: "Settings",  icon: Settings },
  { href: "/help",               label: "Help",       icon: HelpCircle },
] as const

// ── Nav link ──────────────────────────────────────────────────

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
        active
          ? "bg-[#7F77DD]/15 text-[#7F77DD]"
          : "text-white/50 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon
        size={16}
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-[#7F77DD]" : "text-white/35 group-hover:text-white/70"
        )}
      />
      {label}
      {active && (
        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-[#7F77DD]" aria-hidden="true" />
      )}
    </Link>
  )
}

// ────────────────────────────────────────────────────────────
// Sidebar
// ────────────────────────────────────────────────────────────

export function Sidebar() {
  const pathname = usePathname()
  const { profile } = useUser()

  const remaining =
    profile ? Math.max(0, profile.designs_limit - profile.designs_used) : null
  const pct = profile
    ? Math.round((profile.designs_used / profile.designs_limit) * 100)
    : 0

  return (
    <aside className="hidden lg:flex w-56 shrink-0 flex-col border-r border-white/6 bg-[#0d0f14] h-full">
      <div className="flex flex-col flex-1 overflow-y-auto px-3 pt-6 pb-4">
        {/* ── Main nav ── */}
        <nav aria-label="Main navigation" className="space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href)
              }
            />
          ))}
        </nav>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Usage meter ── */}
        {remaining !== null && (
          <div className="mb-4 rounded-xl border border-white/8 bg-white/3 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white/60">Designs used</span>
              <span className="text-xs font-semibold text-white">
                {profile?.designs_used}/{profile?.designs_limit}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-orange-400" : "bg-[#7F77DD]"
                )}
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            {remaining === 0 && (
              <Link
                href="/dashboard/upgrade"
                className="flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors"
              >
                <Zap size={11} />
                Upgrade for more
              </Link>
            )}
          </div>
        )}

        {/* ── Bottom nav ── */}
        <nav aria-label="Secondary navigation" className="space-y-0.5 border-t border-white/6 pt-3">
          {NAV_BOTTOM.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname.startsWith(item.href)}
            />
          ))}
        </nav>
      </div>
    </aside>
  )
}
