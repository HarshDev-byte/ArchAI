"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";

/**
 * Wraps the app with a stable QueryClient instance.
 * The client is created once per component mount (not module load)
 * so it is properly isolated between renders / tests.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't refetch on window focus for long-running AI tasks
            refetchOnWindowFocus: false,
            // Retry failed requests once before surfacing error
            retry: 1,
            // Cache data for 5 minutes
            staleTime: 5 * 60 * 1_000,
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
      )}
    </QueryClientProvider>
  );
}
