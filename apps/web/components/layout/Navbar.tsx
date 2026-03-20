"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LogOut, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useUser } from "@/hooks/use-user"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface NavbarProps {
  onToggleSidebar?: () => void
  isSidebarOpen?: boolean
}

export function Navbar({ onToggleSidebar, isSidebarOpen }: NavbarProps) {
  const router = useRouter()
  const { user, profile } = useUser()
  const [isSigningOut, setIsSigningOut] = useState(false)
  
  const supabase = createClient()

  // Calculate designs remaining
  const designsRemaining = profile 
    ? Math.max(0, profile.designs_limit - profile.designs_used)
    : 0

  // Get user initials
  const getInitials = (name?: string) => {
    if (!name) return user?.email?.charAt(0).toUpperCase() || "U"
    return name
      .split(" ")
      .map(word => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  // Get plan badge variant
  const getPlanVariant = (plan?: string) => {
    switch (plan?.toLowerCase()) {
      case "enterprise":
        return "default" // Purple
      case "builder":
        return "secondary" // Blue-ish
      case "starter":
      default:
        return "outline" // Gray
    }
  }

  // Sign out handler
  const handleSignOut = async () => {
    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      router.push("/login")
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-white/8 bg-[#0a0b10] px-4 md:px-6">
      {/* Left side */}
      <div className="flex items-center gap-4">
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="sm"
          className="md:hidden"
          onClick={onToggleSidebar}
        >
          {isSidebarOpen ? (
            <X size={20} />
          ) : (
            <Menu size={20} />
          )}
        </Button>

        {/* Logo */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[#7F77DD]">
            DesignAI
          </h1>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Plan badge */}
        {profile?.plan && (
          <Badge 
            variant={getPlanVariant(profile.plan)}
            className="hidden sm:inline-flex"
          >
            {profile.plan.charAt(0).toUpperCase() + profile.plan.slice(1)}
          </Badge>
        )}

        {/* Designs remaining */}
        <div className="hidden sm:flex items-center gap-1 text-sm text-white/60">
          <span className="font-medium text-white">
            {designsRemaining}
          </span>
          <span>designs left</span>
        </div>

        {/* User avatar */}
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-[#7F77DD]/10 text-[#7F77DD] text-xs font-medium">
            {getInitials(profile?.full_name)}
          </AvatarFallback>
        </Avatar>

        {/* Sign out button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="text-white/60 hover:text-white hover:bg-white/5"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline ml-2">
            {isSigningOut ? "Signing out..." : "Sign out"}
          </span>
        </Button>
      </div>
    </header>
  )
}