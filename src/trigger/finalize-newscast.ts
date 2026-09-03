import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";

export type FinalizeNewscastPayload = { newscastId: string; audioUrl: string; videoUrl: string };
export type FinalizeNewscastOutput = { completed: true };

/**
 * Last stage: mark the newscast completed and record the finished media URLs.
 */
export const finalizeNewscast = task({
  id: "finalize-newscast",
  run: async (payload: FinalizeNewscastPayload): Promise<FinalizeNewscastOutput> => {
    await updateNewscastStatus(payload.newscastId, "finalizing");
    logger.info("finalize-newscast started", { newscastId: payload.newscastId });

    await updateNewscastStatus(payload.newscastId, "completed", {
      patch: { completed_at: new Date().toISOString() },
    });

    return { completed: true };
  },
});
