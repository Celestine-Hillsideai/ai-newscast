import type { SupabaseClient } from "@supabase/supabase-js";

const WINDOW_MINUTES = 10;
const MAX_REQUESTS_PER_WINDOW = 3;

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

/**
 * Rate limits POST /api/newscasts per user. Backed by a COUNT query against
 * newscasts itself (RLS-scoped to the caller via newscasts_select_own) —
 * no new table or external service needed. The pipeline this gates calls
 * five paid providers per run, so the limit is deliberately tight.
 */
export async function checkNewscastRateLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const { count, error } = await supabase
    .from("newscasts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", windowStart);

  if (error) throw error;

  if ((count ?? 0) >= MAX_REQUESTS_PER_WINDOW) {
    return { allowed: false, retryAfterSeconds: WINDOW_MINUTES * 60 };
  }

  return { allowed: true };
}
