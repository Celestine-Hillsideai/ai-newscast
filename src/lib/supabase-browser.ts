import { createBrowserClient } from "@supabase/ssr";

/**
 * The only Supabase client the browser ever sees — anon key, RLS-protected.
 * Session comes from the anonymous-sign-in cookie set by src/middleware.ts.
 * See workflows/architecture-communication.md section 5 for the secret split.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set (see .env.example)."
    );
  }

  return createBrowserClient(url, anonKey);
}
