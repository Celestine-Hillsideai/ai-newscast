import { unlink, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { getSupabaseServiceClient } from "../lib/supabase.js";
import { RemotionVideoProvider } from "../lib/providers/video.js";
import { hashCacheKey } from "../lib/cache.js";
import type { SummarizeNewsOutput } from "./summarize-news.js";
import type { NewscastVideoProps } from "../remotion/types.js";

export type GenerateVideoPayload = {
  newscastId: string;
  summary: SummarizeNewsOutput;
  audioUrl: string;
  audioHash: string;
  durationSeconds: number;
};
export type GenerateVideoOutput = { videoUrl: string };

const BUCKET = "newscast-video";
const TEMPLATE_VERSION = "v1";
const videoRenderer = new RemotionVideoProvider();

/**
 * Renders the seven-scene video via Remotion, synced exactly to the real
 * audio duration, and caches on media_assets.hash — same pattern as Phase
 * 4's audio caching.
 * See AI_NewsCast_Coding_Agent_Master_Specification.txt: VIDEO, CACHING, MEDIA STORAGE.
 */
export const generateVideo = task({
  id: "generate-video",
  // Remotion's bundle() step (webpack/rspack) plus headless Chromium rendering are both
  // memory-hungry; the platform default machine OOM-killed a real production run mid-render
  // (TASK_PROCESS_OOM_KILLED). Scoped to this task only — the rest of the pipeline's tasks are
  // lightweight and don't need the larger (costlier) machine.
  machine: "large-1x",
  run: async (payload: GenerateVideoPayload): Promise<GenerateVideoOutput> => {
    await updateNewscastStatus(payload.newscastId, "generating_video");
    logger.info("generate-video started", { newscastId: payload.newscastId });

    const supabase = getSupabaseServiceClient();
    const hash = hashCacheKey({
      summary: payload.summary,
      audioHash: payload.audioHash,
      templateVersion: TEMPLATE_VERSION,
    });

    const { data: existing, error: lookupError } = await supabase
      .from("media_assets")
      .select("url")
      .eq("hash", hash)
      .eq("type", "video")
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let videoUrl: string;

    if (existing) {
      logger.info("generate-video cache hit", { newscastId: payload.newscastId });
      videoUrl = existing.url as string;
    } else {
      const sourceNames = await resolveSourceNames(payload.summary.sourceIds);

      const inputProps: NewscastVideoProps = {
        headline: payload.summary.headline,
        dek: payload.summary.dek,
        whatHappened: payload.summary.whatHappened,
        keyDevelopments: payload.summary.keyDevelopments,
        whyItMatters: payload.summary.whyItMatters,
        timeline: payload.summary.timeline,
        sourceNames,
        audioUrl: payload.audioUrl,
        durationSeconds: payload.durationSeconds,
      };

      const outputPath = path.join(os.tmpdir(), `${hash}.mp4`);
      await videoRenderer.render({ inputProps, outputPath });

      const videoBuffer = await readFile(outputPath);
      const storagePath = `${payload.newscastId}/${hash}.mp4`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, videoBuffer, { contentType: "video/mp4", upsert: true });
      if (uploadError) throw uploadError;

      await unlink(outputPath).catch((error) =>
        logger.warn("generate-video: failed to clean up temp file", {
          newscastId: payload.newscastId,
          error: (error as Error).message,
        })
      );

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      videoUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase.from("media_assets").insert({
        newscast_id: payload.newscastId,
        type: "video",
        bucket: BUCKET,
        storage_path: storagePath,
        url: videoUrl,
        duration_seconds: payload.durationSeconds,
        mime_type: "video/mp4",
        hash,
        metadata: { templateVersion: TEMPLATE_VERSION },
      });
      if (insertError) throw insertError;
    }

    await updateNewscastStatus(payload.newscastId, "generating_video", {
      provider: "remotion",
      metadata: { templateVersion: TEMPLATE_VERSION },
    });

    logger.info("generate-video completed", { newscastId: payload.newscastId });

    return { videoUrl };
  },
});

async function resolveSourceNames(sourceIds: string[]): Promise<string[]> {
  if (sourceIds.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("articles")
    .select("news_sources(name)")
    .in("id", sourceIds);

  if (error) throw error;

  const names = new Set<string>();
  for (const row of data ?? []) {
    const source = row.news_sources as { name?: string } | null;
    if (source?.name) names.add(source.name);
  }
  return [...names];
}
