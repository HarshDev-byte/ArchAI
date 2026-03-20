import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase server client — safe to import in Server Components, Route Handlers,
 * and Server Actions. Reads/writes cookies via Next.js `cookies()`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) { // eslint-disable-line @typescript-eslint/no-explicit-any
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: any }) => // eslint-disable-line @typescript-eslint/no-explicit-any
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies can only be
            // mutated inside Server Actions / Route Handlers, safe to ignore.
          }
        },
      },
    }
  );
}

/**
 * Supabase middleware client helper — use in middleware.ts to refresh sessions.
 * Pass in the request/response objects from Next.js middleware.
 */
export function createMiddlewareClient(request: Request) {
  // Implemented inline in middleware.ts to allow response mutation.
  // This export is a named re-export for discoverability.
  void request;
  throw new Error(
    "Use createServerClient directly in middleware.ts — see Next.js Supabase docs."
  );
}
