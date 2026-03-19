"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Box, FileText, FileCode2, Link2, Check, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toastSuccess, toastError } from "@/lib/toast";
import type { LayoutRecord } from "@/components/results/LayoutSelector";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

type ExportKey = "gltf" | "pdf" | "dxf" | "share";

interface ExportAction {
  key:      ExportKey;
  label:    string;
  icon:     React.ReactNode;
  accent:   string;
  disabled?: boolean;
}

const ACTIONS: ExportAction[] = [
  {
    key:    "gltf",
    label:  "Export 3D",
    icon:   <Box size={14} />,
    accent: "#7F77DD",
  },
  {
    key:    "pdf",
    label:  "Download PDF",
    icon:   <FileText size={14} />,
    accent: "#f87171",
  },
  {
    key:    "dxf",
    label:  "Export DXF",
    icon:   <FileCode2 size={14} />,
    accent: "#f59e0b",
  },
  {
    key:    "share",
    label:  "Share Link",
    icon:   <Link2 size={14} />,
    accent: "#34d399",
  },
];

// ─────────────────────────────────────────────────────────────
// Auth token helper
// ─────────────────────────────────────────────────────────────

async function getAuthToken(): Promise<string> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? "";
}

// ─────────────────────────────────────────────────────────────
// Download helper — triggers browser file save from a URL
// ─────────────────────────────────────────────────────────────

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ─────────────────────────────────────────────────────────────
// Real export runner
// ─────────────────────────────────────────────────────────────

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function runExport(
  key:       ExportKey,
  layout:    LayoutRecord | null,
  projectId: string,
): Promise<string> {
  // Share: clipboard only, no API call
  if (key === "share") {
    const url = window.location.href;
    await navigator.clipboard.writeText(url);
    return url;
  }

  const token    = await getAuthToken();
  const endpoint = `${API}/api/v1/export/${key}`;

  const body: Record<string, string> = { project_id: projectId };
  if (layout?.id && key !== "pdf") {
    body.layout_id = layout.id;
  }

  const res = await fetch(endpoint, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? `Export failed (${res.status})`);
  }

  const data: { download_url: string } = await res.json();
  const { download_url } = data;

  // Trigger browser download
  const filenames: Record<ExportKey, string> = {
    gltf:  `${projectId.slice(0, 8)}_building.glb`,
    pdf:   `${projectId.slice(0, 8)}_report.pdf`,
    dxf:   `${projectId.slice(0, 8)}_floorplan.dxf`,
    share: "",
  };
  triggerDownload(download_url, filenames[key]);

  return download_url;
}

// ─────────────────────────────────────────────────────────────
// Single export button
// ─────────────────────────────────────────────────────────────

interface ExportButtonProps {
  action:    ExportAction;
  status:    "idle" | "loading" | "done";
  onClick:   () => void;
  disabled:  boolean;
}

function ExportButton({ action, status, onClick, disabled }: ExportButtonProps) {
  const isLoading = status === "loading";
  const isDone    = status === "done";

  return (
    <motion.button
      id={`btn-export-${action.key}`}
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        "relative flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl",
        "text-xs font-semibold border transition-all duration-150 select-none",
        "flex-1 sm:flex-none sm:min-w-[110px]",
        isLoading || disabled
          ? "cursor-not-allowed opacity-60"
          : "cursor-pointer",
      )}
      style={{
        borderColor: `${action.accent}35`,
        background:  isDone
          ? `${action.accent}20`
          : isLoading
          ? `${action.accent}10`
          : `${action.accent}12`,
        color:       isDone
          ? action.accent
          : isLoading
          ? `${action.accent}99`
          : action.accent,
        boxShadow:   isDone ? `0 0 12px ${action.accent}30` : undefined,
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isLoading ? (
          <motion.span
            key="loading"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            <Loader2 size={13} className="animate-spin" />
            <span>Exporting…</span>
          </motion.span>
        ) : isDone ? (
          <motion.span
            key="done"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            <Check size={13} />
            <span>Done!</span>
          </motion.span>
        ) : (
          <motion.span
            key="idle"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5"
          >
            {action.icon}
            <span>{action.label}</span>
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ─────────────────────────────────────────────────────────────
// Main ExportBar — sticky bottom
// ─────────────────────────────────────────────────────────────

export interface ExportBarProps {
  layout:    LayoutRecord | null;
  projectId: string;
}

export function ExportBar({ layout, projectId }: ExportBarProps) {
  const [statuses, setStatuses] = useState<Record<ExportKey, "idle" | "loading" | "done">>({
    gltf:  "idle",
    pdf:   "idle",
    dxf:   "idle",
    share: "idle",
  });

  // Track if any export is running
  const anyLoading = Object.values(statuses).some((s) => s === "loading");

  const handleExport = useCallback(
    async (key: ExportKey) => {
      if (statuses[key] === "loading") return;

      setStatuses((prev) => ({ ...prev, [key]: "loading" }));

      try {
        await runExport(key, layout, projectId);

        setStatuses((prev) => ({ ...prev, [key]: "done" }));

        // Success toast
        const messages: Record<ExportKey, string> = {
          gltf:  "3D model export started — check your downloads",
          pdf:   "PDF report ready — check your downloads",
          dxf:   "DXF file export started — check your downloads",
          share: "Link copied to clipboard!",
        };
        toastSuccess(messages[key]);

        // Reset after 2.5s
        setTimeout(() => {
          setStatuses((prev) => ({ ...prev, [key]: "idle" }));
        }, 2_500);
      } catch {
        setStatuses((prev) => ({ ...prev, [key]: "idle" }));
        toastError("Export failed — please try again");
      }
    },
    [statuses, layout, projectId],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.1 }}
      className={cn(
        "sticky bottom-0 z-30 w-full",
        "border-t border-white/8 bg-[#0a0c11]/90 backdrop-blur-xl",
        "px-4 py-3",
      )}
    >
      {/* Inner wrapper */}
      <div className="max-w-3xl mx-auto flex items-center gap-2 flex-wrap sm:flex-nowrap">
        {/* Label */}
        <div className="hidden sm:flex flex-col mr-1 shrink-0">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Export</p>
          <p className="text-[9px] text-white/15 mt-0.5">
            {layout ? layout.concept_name : "Select a layout first"}
          </p>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-8 bg-white/6 mx-1 shrink-0" />

        {/* Buttons */}
        {ACTIONS.map((action) => (
          <ExportButton
            key={action.key}
            action={action}
            status={statuses[action.key]}
            onClick={() => handleExport(action.key)}
            disabled={!layout && action.key !== "share"}
          />
        ))}
      </div>

      {/* No layout hint */}
      <AnimatePresence>
        {!layout && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[10px] text-white/20 text-center mt-1.5 sm:hidden"
          >
            Select a layout to enable exports
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
