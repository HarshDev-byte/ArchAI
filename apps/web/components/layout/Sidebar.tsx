"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LayoutDashboard, FolderOpen, Settings } from "lucide-react"
import { cn } from "@/lib/utils"

interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Projects",
    href: "/dashboard/projects",
    icon: FolderOpen,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function Sidebar({ isOpen = true, onClose }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] w-64 transform border-r border-white/8 bg-[#0a0b10] transition-transform duration-200 ease-in-out md:relative md:top-0 md:z-0 md:h-full md:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <nav className="flex h-full flex-col p-4">
          <ul className="space-y-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== "/dashboard" && pathname.startsWith(item.href))
              
              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                      "hover:bg-white/5 hover:text-white",
                      isActive
                        ? "border-l-2 border-[#7F77DD] bg-[#7F77DD]/10 text-[#7F77DD] pl-[11px]"
                        : "text-white/60 border-l-2 border-transparent pl-[11px]"
                    )}
                  >
                    <item.icon 
                      size={18} 
                      className={cn(
                        isActive ? "text-[#7F77DD]" : "text-white/40"
                      )} 
                    />
                    {item.name}
                  </Link>
                </li>
              )
            })}
          </ul>

          {/* Footer */}
          <div className="mt-auto pt-4 border-t border-white/8">
            <div className="text-xs text-white/40 px-3">
              <p>DesignAI v1.0</p>
              <p className="mt-1">AI-powered architecture</p>
            </div>
          </div>
        </nav>
      </aside>
    </>
  )
}