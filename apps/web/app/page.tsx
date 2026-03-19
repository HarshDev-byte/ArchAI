"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Zap, Building2, FileText, ChevronRight,
  Map, Box,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Feature cards data
// ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <Map size={22} />,
    accent: "#60a5fa",
    title: "Draw your plot",
    description:
      "Click anywhere on a live satellite map to outline your land parcel. The AI instantly reads area, shape, and surrounding context.",
  },
  {
    icon: <Zap size={22} />,
    accent: "#7F77DD",
    title: "AI feasibility — in seconds",
    description:
      "Claude analyses FSI limits, zoning setbacks, and local bye-laws. Get a verdict with confidence score before spending a rupee.",
  },
  {
    icon: <Box size={22} />,
    accent: "#34d399",
    title: "3 layouts, 3D ready",
    description:
      "Receive three optimised building configurations with unit mix, cost estimates, ROI %, and an interactive 3D preview you can orbit.",
  },
];

const STATS = [
  { value: "< 60s", label: "Feasibility check" },
  { value: "3",     label: "Layout options" },
  { value: "PDF",   label: "Instant reports" },
  { value: "glTF",  label: "3D export" },
];

// ─────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] },
  }),
};

// ─────────────────────────────────────────────────────────────
// Landing page
// ─────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0d0f14] text-[#e8ecf4] overflow-x-hidden">

      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 flex items-center justify-between
                      px-6 md:px-12 h-16
                      border-b border-white/6 bg-[#0d0f14]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#7F77DD] flex items-center justify-center
                          shadow-md shadow-[#7F77DD]/30">
            <Building2 size={14} color="white" />
          </div>
          <span className="font-bold text-base tracking-tight">
            Design<span className="text-[#7F77DD]">AI</span>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            id="cta-nav-register"
            className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl
                       bg-[#7F77DD] hover:bg-[#6b64c4] text-white transition-all duration-150
                       shadow-lg shadow-[#7F77DD]/25"
          >
            Start for free
            <ChevronRight size={14} />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center text-center
                          px-6 pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden">

        {/* Background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[600px]
                          rounded-full bg-[#7F77DD]/10 blur-[120px]" />
        </div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#7F77DD]/30
                     bg-[#7F77DD]/10 px-4 py-1.5 text-xs font-semibold text-[#a5b4fc]"
        >
          <Zap size={11} />
          Powered by Claude AI · Instant feasibility checks
        </motion.div>

        {/* Headline */}
        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="max-w-3xl text-4xl md:text-6xl font-black tracking-tight leading-[1.08]
                     bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent"
        >
          Design your building<br className="hidden md:block" />
          <span className="text-[#7F77DD]"> in minutes</span>, not months
        </motion.h1>

        {/* Sub */}
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-5 max-w-xl text-base md:text-lg text-white/50 leading-relaxed"
        >
          Draw a land parcel on a satellite map. Get an instant AI feasibility verdict,
          three unique building layouts with 3D previews, and export-ready PDF reports —
          all in under two minutes.
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-8 flex items-center gap-3 flex-wrap justify-center"
        >
          <Link
            href="/register"
            id="cta-hero-register"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm
                       bg-[#7F77DD] hover:bg-[#6b64c4] text-white transition-all duration-150
                       shadow-xl shadow-[#7F77DD]/30 hover:shadow-[#7F77DD]/50
                       hover:-translate-y-0.5 active:translate-y-0"
          >
            Start for free
            <ChevronRight size={15} />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm
                       border border-white/10 text-white/60 hover:text-white hover:border-white/20
                       transition-all duration-150"
          >
            Sign in
          </Link>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-xl"
        >
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              className="rounded-2xl border border-white/6 bg-white/3 px-4 py-4 text-center"
            >
              <p className="text-xl font-black text-white">{value}</p>
              <p className="text-[11px] text-white/35 mt-0.5 font-medium">{label}</p>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 md:px-12 py-16 md:py-24 max-w-5xl mx-auto">
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-2xl md:text-3xl font-black text-white">
            Everything you need, nothing you don&apos;t
          </h2>
          <p className="mt-3 text-white/45 text-sm md:text-base max-w-lg mx-auto">
            From raw parcel to exportable designs — the entire architectural pre-design
            workflow in one AI-native tool.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="group rounded-2xl border border-white/6 bg-[#111318] p-6
                         hover:border-white/12 hover:-translate-y-1 transition-all duration-300"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                style={{
                  background: f.accent + "18",
                  color: f.accent,
                  border: `1px solid ${f.accent}30`,
                }}
              >
                {f.icon}
              </div>
              <h3 className="font-bold text-white text-base mb-2">{f.title}</h3>
              <p className="text-sm text-white/45 leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-6 md:px-12 pb-20 max-w-3xl mx-auto">
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative rounded-3xl overflow-hidden border border-[#7F77DD]/25
                     bg-gradient-to-br from-[#7F77DD]/10 to-transparent p-8 md:p-12 text-center"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,#7F77DD15,transparent_60%)]" />
          <FileText size={28} className="mx-auto mb-4 text-[#7F77DD]" />
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            Ready to design smarter?
          </h2>
          <p className="text-white/45 text-sm mb-6 max-w-sm mx-auto">
            Free account includes 3 full AI design runs. No credit card required.
          </p>
          <Link
            href="/register"
            id="cta-bottom-register"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-bold text-sm
                       bg-[#7F77DD] hover:bg-[#6b64c4] text-white transition-all duration-150
                       shadow-xl shadow-[#7F77DD]/30"
          >
            Create your free account
            <ChevronRight size={15} />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/6 px-6 md:px-12 py-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center
                        justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#7F77DD] flex items-center justify-center">
              <Building2 size={11} color="white" />
            </div>
            <span className="text-sm font-semibold text-white/60">
              Design<span className="text-[#7F77DD]">AI</span>
            </span>
          </div>
          <p className="text-xs text-white/25 text-center">
            AI-generated reports are preliminary. Always verify with a licensed architect.
          </p>
          <div className="flex items-center gap-5">
            {["Privacy", "Terms", "Contact"].map((l) => (
              <a
                key={l}
                href="#"
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
