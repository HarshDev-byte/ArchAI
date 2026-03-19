"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"
import type { ProfileRow } from "@/types/database"

interface UseUserReturn {
  user: User | null
  profile: ProfileRow | null
  isLoading: boolean
  isAuthenticated: boolean
  refetch: () => void
}

/**
 * Returns the current Supabase auth user + their profile row from the DB.
 *
 * - `isLoading`       true during the initial session hydration
 * - `isAuthenticated` true once a user session is confirmed
 * - `profile`         null if the profile row hasn't been created yet
 *
 * Uses a single Supabase client instance via createClient(),
 * and subscribes to onAuthStateChange so the hook stays reactive.
 */
export function useUser(): UseUserReturn {
  const supabase = createClient()

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function fetchProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single()

    if (!error && data) {
      setProfile(data as ProfileRow)
    }
  }

  useEffect(() => {
    // 1. Hydrate session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    // 2. React to sign-in / sign-out events
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id)
      } else {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    user,
    profile,
    isLoading,
    isAuthenticated: !!user,
    refetch: () => { if (user) fetchProfile(user.id) },
  }
}
