import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: {
    template: "%s | DesignAI",
    default: "Auth | DesignAI",
  },
}

/**
 * Shared layout for auth routes: (auth)/login and (auth)/register.
 * Renders a centered, full-screen dark canvas with the DesignAI wordmark.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0a0b10] flex flex-col items-center justify-center px-4 py-16">
      {/* ── Background aurora ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        {/* Top-left glow */}
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-[#7F77DD]/12 blur-[120px]" />
        {/* Bottom-right glow */}
        <div className="absolute -bottom-40 -right-20 h-[400px] w-[400px] rounded-full bg-[#7F77DD]/8 blur-[100px]" />
        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Logo ── */}
      <Link href="/" className="mb-8 flex items-center gap-2 group">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7F77DD] shadow-lg shadow-[#7F77DD]/30 transition-transform group-hover:scale-105">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" stroke="white" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
        <span className="text-xl font-semibold tracking-tight text-white">
          Design<span className="text-[#7F77DD]">AI</span>
        </span>
      </Link>

      {/* ── Auth card ── */}
      <div className="w-full max-w-md">{children}</div>

      {/* ── Footer ── */}
      <p className="mt-8 text-xs text-white/25">
        © {new Date().getFullYear()} DesignAI. All rights reserved.
      </p>
    </div>
  )
}
