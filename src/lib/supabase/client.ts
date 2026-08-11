import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client, for Client Components that need live queries
 * (e.g. live status updates during a run). Foundation phase has no callers yet.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
