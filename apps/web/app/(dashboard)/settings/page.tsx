"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  User, Building2, Phone, Save, Loader2,
  Zap, ChevronRight, Crown, BarChart2, CheckCircle2,
} from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { createClient } from "@/lib/supabase/client";
import { toastSuccess, toastError } from "@/lib/toast";
import type { ProfileUpdate } from "@/types/database";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const PLAN_LABELS: Record<string, string>  = { starter: "Starter", pro: "Pro",  enterprise: "Enterprise" };
const PLAN_COLORS: Record<string, string>  = { starter: "#7F77DD", pro: "#f59e0b", enterprise: "#34d399" };
const PLAN_LIMITS: Record<string, number>  = { starter: 3,         pro: 25,       enterprise: 100 };
const PLAN_FEATURES: Record<string, string[]> = {
  starter:    ["3 AI design runs", "PDF export", "3D viewer"],
  pro:        ["25 AI design runs", "DXF + glTF export", "Priority support", "API access"],
  enterprise: ["Unlimited runs", "White-label PDF", "Dedicated support", "Custom integrations"],
};

function FieldWrapper({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-white/40 uppercase tracking-wider block">
        {label}
      </label>
      {children}
    </div>
  );
}

function InputField({
  value, onChange, placeholder, type = "text", icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none">
          {icon}
        </span>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm
                   text-white placeholder:text-white/20 outline-none transition-all
                   focus:ring-2 focus:ring-[#7F77DD]/40 focus:border-[#7F77DD]/50"
        style={{ paddingLeft: icon ? "2.25rem" : undefined }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Settings page
// ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { user, profile, isLoading, refetch } = useUser();

  const [name,    setName]    = useState(profile?.full_name    ?? "");
  const [company, setCompany] = useState(profile?.company_name ?? "");
  const [phone,   setPhone]   = useState(profile?.phone        ?? "");
  const [saving,  setSaving]  = useState(false);

  // Sync local state when profile loads
  if (profile && !name && !company && !phone) {
    setName(profile.full_name ?? "");
    setCompany(profile.company_name ?? "");
    setPhone(profile.phone ?? "");
  }

  const handleSave = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update({
          full_name:    name.trim(),
          company_name: company.trim() || null,
          phone:        phone.trim()   || null,
          updated_at:   new Date().toISOString(),
        } as any) // Type assertion to bypass Supabase type issues
        .eq("id", user.id);

      if (error) throw error;
      toastSuccess("Profile updated successfully!");
      refetch?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Update failed";
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }, [user, name, company, phone, refetch]);

  const plan       = profile?.plan ?? "starter";
  const used       = profile?.designs_used  ?? 0;
  const limit      = profile?.designs_limit ?? PLAN_LIMITS[plan] ?? 3;
  const usagePct   = Math.min((used / limit) * 100, 100);
  const accentColor = PLAN_COLORS[plan] ?? "#7F77DD";

  const fadeUp = {
    hidden:  { opacity: 0, y: 12 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { duration: 0.35, delay: i * 0.07 },
    }),
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-16">
      {/* ── Header ── */}
      <motion.div custom={0} variants={fadeUp} initial="hidden" animate="visible">
        <h1 className="text-xl font-bold text-white">Settings</h1>
        <p className="text-sm text-white/35 mt-1">Manage your profile and subscription</p>
      </motion.div>

      {/* ── Profile card ── */}
      <motion.div
        custom={1}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-2xl border border-white/8 bg-[#111318] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
          <User size={14} className="text-[#7F77DD]" />
          <h2 className="text-sm font-bold text-white">Profile</h2>
        </div>

        <div className="p-5 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-xl bg-white/4 animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <FieldWrapper label="Full name">
                <InputField
                  value={name}
                  onChange={setName}
                  placeholder="Your full name"
                  icon={<User size={13} />}
                />
              </FieldWrapper>

              <FieldWrapper label="Company / firm">
                <InputField
                  value={company}
                  onChange={setCompany}
                  placeholder="Optional — your architecture firm"
                  icon={<Building2 size={13} />}
                />
              </FieldWrapper>

              <FieldWrapper label="Phone">
                <InputField
                  value={phone}
                  onChange={setPhone}
                  placeholder="+91 98765 43210"
                  type="tel"
                  icon={<Phone size={13} />}
                />
              </FieldWrapper>

              <FieldWrapper label="Email">
                <input
                  type="email"
                  value={user?.email ?? ""}
                  disabled
                  className="w-full rounded-xl border border-white/5 bg-white/2 px-3 py-2.5
                             text-sm text-white/30 cursor-not-allowed"
                />
              </FieldWrapper>

              <button
                id="btn-save-profile"
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                           bg-[#7F77DD] hover:bg-[#6b64c4] text-white transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed
                           shadow-lg shadow-[#7F77DD]/20"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* ── Plan & usage card ── */}
      <motion.div
        custom={2}
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="rounded-2xl border border-white/8 bg-[#111318] overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-white/6 flex items-center gap-2">
          <BarChart2 size={14} className="text-[#7F77DD]" />
          <h2 className="text-sm font-bold text-white">Plan &amp; Usage</h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Plan badge row */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Crown size={14} style={{ color: accentColor }} />
                <span
                  className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                  style={{
                    background: accentColor + "20",
                    color:      accentColor,
                    border:     `1px solid ${accentColor}35`,
                  }}
                >
                  {PLAN_LABELS[plan] ?? plan} Plan
                </span>
              </div>
              <p className="text-[11px] text-white/30">
                {PLAN_FEATURES[plan]?.join(" · ")}
              </p>
            </div>
            <button
              id="btn-upgrade"
              disabled
              title="Upgrade coming soon"
              className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-xl
                         border border-white/10 text-white/25 cursor-not-allowed"
            >
              <Zap size={12} />
              Upgrade
              <ChevronRight size={11} />
            </button>
          </div>

          {/* Usage bar */}
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-white/40 font-medium">Designs used</span>
              <span
                className="font-bold tabular-nums"
                style={{ color: usagePct >= 90 ? "#f87171" : usagePct >= 70 ? "#f59e0b" : "#34d399" }}
              >
                {used} / {limit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/6 overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${usagePct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="h-full rounded-full"
                style={{
                  background: usagePct >= 90
                    ? "#f87171"
                    : usagePct >= 70
                    ? "#f59e0b"
                    : `linear-gradient(90deg, ${accentColor}, ${accentColor}cc)`,
                }}
              />
            </div>
            <p className="text-[11px] text-white/25 mt-1.5">
              {Math.max(0, limit - used)} design{limit - used !== 1 ? "s" : ""} remaining
            </p>
          </div>

          {/* Feature checklist */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {(PLAN_FEATURES[plan] ?? []).map((feat) => (
              <div key={feat} className="flex items-center gap-1.5 text-[11px] text-white/45">
                <CheckCircle2 size={11} style={{ color: accentColor }} />
                {feat}
              </div>
            ))}
          </div>

          {/* Upgrade CTA placeholder */}
          {plan === "starter" && (
            <div className="rounded-xl border border-dashed border-white/8 bg-white/2 p-4 text-center">
              <p className="text-xs text-white/40 mb-2">
                Unlock 25 runs, DXF/glTF export, and priority support
              </p>
              <button
                disabled
                className="text-xs font-bold text-[#7F77DD]/50 cursor-not-allowed"
              >
                Upgrade to Pro — coming soon
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
