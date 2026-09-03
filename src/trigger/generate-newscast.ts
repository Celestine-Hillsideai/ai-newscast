import { logger, task } from "@trigger.dev/sdk/v3";
import { taskContext } from "@trigger.dev/core/v3";
import { generateNewscastPayloadSchema } from "../lib/schemas/newscast.js";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { getSupabaseServiceClient } from "../lib/supabase.js";
import { discoverNews } from "./discover-news.js";
import { extractArticles } from "./extract-articles.js";
import { deduplicateNews } from "./deduplicate-news.js";
import { verifyNews } from "./verify-news.js";
import { summarizeNews } from "./summarize-news.js";
import { generatePodcastScript } from "./generate-podcast-script.js";
import { generateAudio } from "./generate-audio.js";
import { generateVideo } from "./generate-video.js";
import { finalizeNewscast } from "./finalize-newscast.js";

export type GenerateNewscastPayload = { newscastId: string; topic: string };

/**
 * Master orchestrator. Runs every stage in strict sequence -
 * DISCOVER -> EXTRACT -> DEDUPLICATE -> VERIFY -> SYNTHESIZE -> WRITE ->
 * NARRATE -> VISUALIZE -> PUBLISH - passing each stage's output into the
 * next, and updates newscasts.status (via updateNewscastStatus) before each
 * one. Any child-task failure fails the whole run and records the reason on
 * the newscasts row, per the spec's ERROR HANDLING section.
 */
export const generateNewscast = task({
  id: "generate-newscast",
  run: async (rawPayload: GenerateNewscastPayload) => {
    const payload = generateNewscastPayloadSchema.parse(rawPayload);
    const { newscastId, topic } = payload;

    // The frontend can't write this itself — newscasts has no UPDATE policy
    // for `authenticated` (only the service-role key writes status/content,
    // per the RLS design in supabase/migrations/0001_init.sql). The
    // generation page needs it to mint a realtime accessToken on refresh, so
    // the orchestrator records its own run id here instead.
    if (taskContext.ctx?.run.id) {
      await getSupabaseServiceClient()
        .from("newscasts")
        .update({ trigger_run_id: taskContext.ctx.run.id })
        .eq("id", newscastId);
    }

    try {
      const discovered = await discoverNews.triggerAndWait({ newscastId, topic });
      if (!discovered.ok) throw new Error(`discover-news failed: ${String(discovered.error)}`);

      const extracted = await extractArticles.triggerAndWait({
        newscastId,
        discoveredUrls: discovered.output.discoveredUrls,
      });
      if (!extracted.ok) throw new Error(`extract-articles failed: ${String(extracted.error)}`);

      const deduped = await deduplicateNews.triggerAndWait({
        newscastId,
        articleIds: extracted.output.articleIds,
      });
      if (!deduped.ok) throw new Error(`deduplicate-news failed: ${String(deduped.error)}`);

      const verified = await verifyNews.triggerAndWait({
        newscastId,
        topic,
        dedupedArticleIds: deduped.output.dedupedArticleIds,
      });
      if (!verified.ok) throw new Error(`verify-news failed: ${String(verified.error)}`);

      const summarized = await summarizeNews.triggerAndWait({
        newscastId,
        topic,
        articleIds: deduped.output.dedupedArticleIds,
        verification: verified.output,
      });
      if (!summarized.ok) throw new Error(`summarize-news failed: ${String(summarized.error)}`);

      const scripted = await generatePodcastScript.triggerAndWait({
        newscastId,
        summary: summarized.output,
      });
      if (!scripted.ok) throw new Error(`generate-podcast-script failed: ${String(scripted.error)}`);

      const audio = await generateAudio.triggerAndWait({
        newscastId,
        scriptText: scripted.output.scriptText,
      });
      if (!audio.ok) throw new Error(`generate-audio failed: ${String(audio.error)}`);

      const video = await generateVideo.triggerAndWait({
        newscastId,
        summary: summarized.output,
        audioUrl: audio.output.audioUrl,
        audioHash: audio.output.hash,
        durationSeconds: audio.output.durationSeconds,
      });
      if (!video.ok) throw new Error(`generate-video failed: ${String(video.error)}`);

      const finalized = await finalizeNewscast.triggerAndWait({
        newscastId,
        audioUrl: audio.output.audioUrl,
        videoUrl: video.output.videoUrl,
      });
      if (!finalized.ok) throw new Error(`finalize-newscast failed: ${String(finalized.error)}`);

      return finalized.output;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error("generate-newscast failed", { newscastId, error: message });
      await updateNewscastStatus(newscastId, "failed", { error: message });
      throw error;
    }
  },
});
