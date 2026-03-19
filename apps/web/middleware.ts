import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// ─────────────────────────────────────────────────────────────
// Route classification
// ─────────────────────────────────────────────────────────────

/** Routes that require an authenticated session. */
const PROTECTED_PREFIXES = ["/dashboard"]

/** Routes only accessible to unauthenticated users. */
const AUTH_ONLY_PREFIXES = ["/login", "/register"]

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
}

function isAuthOnly(pathname: string) {
  return AUTH_ONLY_PREFIXES.some((p) => pathname.startsWith(p))
}

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  let supabaseResponse = NextResponse.next({ request })

  // Build a Supabase client that can read/write cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          // Write to the request first (required by Next.js middleware)
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value)
          )
          // Then rebuild the response so cookies flow downstream
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: any }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // ── IMPORTANT: refresh the session token ──────────────────
  // Do NOT remove this — it keeps the session alive across requests.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ── Route guards ──────────────────────────────────────────

  // 1. Unauthenticated user trying to access a protected route
  if (isProtected(pathname) && !user) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname) // preserve intended destination
    return NextResponse.redirect(loginUrl)
  }

  // 2. Authenticated user trying to access login / register
  if (isAuthOnly(pathname) && user) {
    // Check for ?next= param to honour post-login redirects
    const next = request.nextUrl.searchParams.get("next") ?? "/dashboard"
    return NextResponse.redirect(new URL(next, request.url))
  }

  return supabaseResponse
}

// ─────────────────────────────────────────────────────────────
// Matcher — runs on every route except static assets
// ─────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
