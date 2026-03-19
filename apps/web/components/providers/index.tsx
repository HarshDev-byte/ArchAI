import { Toaster } from "react-hot-toast";
import { QueryProvider } from "./query-provider";
import { SupabaseProvider } from "./supabase-provider";
import type { ReactNode } from "react";

/**
 * Single import for all app-level providers.
 * Import order: Supabase (auth) → React Query → Toast.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <SupabaseProvider>
      <QueryProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#15181f",
              color: "#e8ecf4",
              border: "1px solid #252a3a",
              borderRadius: "8px",
              fontSize: "14px",
            },
            success: {
              iconTheme: { primary: "#4c6ef5", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#fff" },
            },
          }}
        />
      </QueryProvider>
    </SupabaseProvider>
  );
}
