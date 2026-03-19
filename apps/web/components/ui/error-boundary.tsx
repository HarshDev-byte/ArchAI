"use client";

import React, { Component, ErrorInfo } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";

// ─────────────────────────────────────────────────────────────
// Generic Error Boundary
// ─────────────────────────────────────────────────────────────

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  /** Short label for the error message */
  context?: string;
}

interface State {
  hasError: boolean;
  error:    Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  retry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <DefaultErrorUI
          context={this.props.context ?? "This section"}
          error={this.state.error}
          onRetry={this.retry}
        />
      );
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
// Default error UI
// ─────────────────────────────────────────────────────────────

function DefaultErrorUI({
  context,
  error,
  onRetry,
}: {
  context: string;
  error:   Error | null;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-red-500/20
                 bg-red-500/5 px-8 py-10 text-center min-h-[140px]"
    >
      <AlertTriangle size={24} className="text-red-400" />
      <div>
        <p className="text-sm font-semibold text-white/80">{context} encountered an error</p>
        {error && (
          <p className="text-xs text-white/30 mt-1 font-mono max-w-xs truncate">
            {error.message}
          </p>
        )}
      </div>
      <button
        id="btn-error-retry"
        onClick={onRetry}
        className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl
                   border border-white/10 text-white/60 hover:text-white hover:border-white/20
                   transition-colors"
      >
        <RefreshCw size={12} />
        Try again
      </button>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Specialised: 3D viewer fallback
// ─────────────────────────────────────────────────────────────

export function ThreeDViewerFallback({ onRetry }: { onRetry?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/6
                 bg-[#0d0f14] text-center h-full min-h-[220px] px-6"
    >
      <div className="w-12 h-12 rounded-xl bg-white/4 flex items-center justify-center mb-1">
        <AlertTriangle size={20} className="text-white/20" />
      </div>
      <p className="text-sm font-semibold text-white/50">3D preview unavailable</p>
      <p className="text-xs text-white/25 max-w-[200px]">
        WebGL may be unsupported or the geometry failed to load.
      </p>
      {onRetry && (
        <button
          id="btn-3d-retry"
          onClick={onRetry}
          className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl
                     border border-white/10 text-white/50 hover:text-white hover:border-white/20
                     transition-colors mt-1"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Error Boundary wrapper for 3D viewer with custom fallback
// ─────────────────────────────────────────────────────────────

interface ThreeDBoundaryProps {
  children: React.ReactNode;
}

interface ThreeDState {
  hasError: boolean;
}

export class ThreeDErrorBoundary extends Component<ThreeDBoundaryProps, ThreeDState> {
  state: ThreeDState = { hasError: false };

  static getDerivedStateFromError(): ThreeDState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[3D ErrorBoundary]", error, info.componentStack);
  }

  retry = () => this.setState({ hasError: false });

  render() {
    if (this.state.hasError) {
      return <ThreeDViewerFallback onRetry={this.retry} />;
    }
    return this.props.children;
  }
}

// ─────────────────────────────────────────────────────────────
// Additional Specialized Error Boundaries
// ─────────────────────────────────────────────────────────────

/** Error boundary for form sections */
export function FormErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      context="Form"
      fallback={
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <AlertTriangle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-white/80">Form encountered an error</p>
          <p className="text-xs text-white/40 mt-1">Please refresh the page</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

/** Error boundary for data sections */
export function DataErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      context="Data loading"
      fallback={
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <AlertTriangle size={20} className="text-red-400 mx-auto mb-2" />
          <p className="text-sm text-white/80">Failed to load data</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-3 py-1.5 text-xs bg-white/8 hover:bg-white/12 
                       rounded-lg border border-white/10 transition-colors"
          >
            Retry
          </button>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
