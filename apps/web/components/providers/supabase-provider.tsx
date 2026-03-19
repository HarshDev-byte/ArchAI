"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

interface SupabaseContextValue {
  supabase: ReturnType<typeof createClient>;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
}

const SupabaseContext = createContext<SupabaseContextValue | undefined>(
  undefined
);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function SupabaseProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Hydrate session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes and refresh router
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, router]);

  return (
    <SupabaseContext.Provider value={{ supabase, user, session, isLoading }}>
      {children}
    </SupabaseContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────

export function useSupabase() {
  const context = useContext(SupabaseContext);
  if (!context) {
    throw new Error("useSupabase must be used within a <SupabaseProvider>");
  }
  return context;
}

export function useUser() {
  return useSupabase().user;
}

export function useSession() {
  return useSupabase().session;
}
