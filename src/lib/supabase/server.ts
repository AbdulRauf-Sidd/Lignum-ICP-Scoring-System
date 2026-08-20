import { createClient } from "@supabase/supabase-js";

// Server-only. Uses the service_role key, which bypasses RLS — safe here
// only because this file is never imported by client components and the
// app has no per-user auth yet (matches how n8n itself accesses the DB).
export function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set.");
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
