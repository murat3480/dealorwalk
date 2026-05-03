import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Service-role client for server-only operations (Storage uploads, bypass RLS when configured).
 * Set SUPABASE_SERVICE_ROLE_KEY in `.env.local` for reliable media uploads.
 */
export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
