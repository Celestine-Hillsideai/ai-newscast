import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import WebSocket from "ws";

let cachedClient: SupabaseClient | undefined;

// @supabase/realtime-js declares its own WebSocketLikeConstructor for this
// option, but it's a transitive dependency we don't import types from
// directly. `ws`'s constructor type is structurally compatible but has
// overloads TS can't match against that interface, hence the cast below.
type WebSocketLikeConstructor = new (
  address: string | URL,
  protocols?: string | string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => any;

/**
 * The only place Trigger.dev tasks touch Supabase credentials. Uses the
 * service-role key because tasks run outside any user session and must be
 * able to write status/events for any newscast — RLS is the backstop for
 * the frontend's own reads/writes, not for this backend-to-database path.
 * See workflows/architecture-communication.md section 3.
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example)."
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false },
    // These tasks never use realtime channels — they only do REST
    // (from().select/insert/update()) calls. supabase-js still constructs a
    // RealtimeClient internally and requires a WebSocket implementation to
    // exist at construction time; the production runtime is Node 21, which
    // predates Node's native WebSocket (added in 22), so it throws without
    // this. Node 22+ (e.g. local dev) doesn't need it, but passing `ws`
    // explicitly makes this work identically on every Node version.
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  });
  return cachedClient;
}
