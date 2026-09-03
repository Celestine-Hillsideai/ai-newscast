import { logger, metadata } from "@trigger.dev/sdk/v3";
import { getSupabaseServiceClient } from "./supabase.js";
import type { NewscastStatus } from "./schemas/newscast.js";

/**
 * The single place every task calls to report progress. Implements the
 * dual-write from workflows/architecture-communication.md section 3:
 *   1. Trigger.dev Realtime metadata, for the browser subscribed to this run.
 *   2. Supabase (newscasts.status + a generation_events row), so the result
 *      survives a page refresh and outlives the run itself.
 */
export async function updateNewscastStatus(
  newscastId: string,
  stage: NewscastStatus,
  options: {
    patch?: Record<string, unknown>;
    provider?: string;
    error?: string;
    /** Recorded on the generation_events row — e.g. { promptVersion, model }. */
    metadata?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const { patch, provider, error, metadata: eventMetadata } = options;

  metadata.set("stage", stage);

  const supabase = getSupabaseServiceClient();
  const startedAt = Date.now();

  const { error: updateError } = await supabase
    .from("newscasts")
    .update({ status: stage, ...(error ? { error_message: error } : {}), ...patch })
    .eq("id", newscastId);

  if (updateError) {
    logger.error("Failed to update newscast status", {
      newscastId,
      stage,
      error: updateError.message,
    });
    throw updateError;
  }

  const { error: eventError } = await supabase.from("generation_events").insert({
    newscast_id: newscastId,
    stage,
    provider: provider ?? null,
    status: error ? "failed" : "succeeded",
    duration_ms: Date.now() - startedAt,
    error: error ?? null,
    metadata: eventMetadata ?? {},
  });

  if (eventError) {
    logger.error("Failed to record generation event", {
      newscastId,
      stage,
      error: eventError.message,
    });
  }

  logger.info("newscast stage updated", { newscastId, stage, provider });
}
