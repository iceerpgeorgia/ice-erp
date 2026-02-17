import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-side client: prefers service role (bypasses RLS), falls back to anon if needed
export function getSupabaseServer(): SupabaseClient {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url) throw new Error("SUPABASE_URL is not set");
  const key = serviceKey || anonKey;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set");
  return createClient(url, key, { auth: { persistSession: false } });
}

// Browser/client-side: uses public envs; never expose service role key
export function getSupabaseBrowser(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!url || !anon) throw new Error("NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
  return createClient(url, anon, { auth: { persistSession: true } });
}

