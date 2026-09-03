import { createHash } from "node:crypto";
import { getSupabaseServiceClient } from "./supabase.js";

/**
 * Deterministic cache key over any JSON-serializable input, per the spec's
 * CACHING section ("use deterministic hashes"). Keys are sorted so that
 * `{a:1,b:2}` and `{b:2,a:1}` hash the same.
 */
export function hashCacheKey(input: unknown): string {
  return createHash("sha256").update(stableStringify(input)).digest("hex");
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function getCached<T>(key: string): Promise<T | null> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("provider_cache")
    .select("value")
    .eq("cache_key", key)
    .maybeSingle();

  if (error) throw error;
  return (data?.value as T | undefined) ?? null;
}

export async function setCached(key: string, value: unknown): Promise<void> {
  const supabase = getSupabaseServiceClient();
  const { error } = await supabase
    .from("provider_cache")
    .upsert({ cache_key: key, value: value as never });

  if (error) throw error;
}
