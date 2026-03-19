import { Navbar } from "@/components/layout/Navbar"
import { Sidebar } from "@/components/layout/Sidebar"
import { PageTransition } from "@/components/ui/page-transition"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0a0b10]">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main
          id="dashboard-main"
          className="flex-1 overflow-y-auto px-4 py-6 md:px-6 md:py-8 lg:px-8"
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  )
}
