import { logger, task } from "@trigger.dev/sdk/v3";
import { parseBuffer } from "music-metadata";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { getSupabaseServiceClient } from "../lib/supabase.js";
import { ElevenLabsProvider, getDefaultModelId, getDefaultVoiceId } from "../lib/providers/tts.js";
import { hashCacheKey } from "../lib/cache.js";

export type GenerateAudioPayload = { newscastId: string; scriptText: string };
export type GenerateAudioOutput = { audioUrl: string; durationSeconds: number; hash: string };

const BUCKET = "newscast-audio";
const ttsProvider = new ElevenLabsProvider();

/**
 * Synthesize the script to MP3 via ElevenLabs, upload to Supabase Storage,
 * and cache on a hash of all output-affecting parameters. Unlike the JSON
 * provider_cache table used in Phases 2-3, audio is binary — this reuses
 * media_assets.hash (unused since the Phase 1 migration) as the cache: an
 * existing row with a matching hash is reused instead of calling ElevenLabs
 * again.
 * See AI_NewsCast_Coding_Agent_Master_Specification.txt: PODCAST, CACHING, MEDIA STORAGE.
 */
export const generateAudio = task({
  id: "generate-audio",
  run: async (payload: GenerateAudioPayload): Promise<GenerateAudioOutput> => {
    await updateNewscastStatus(payload.newscastId, "generating_audio");
    logger.info("generate-audio started", { newscastId: payload.newscastId });

    const voiceId = getDefaultVoiceId();
    const modelId = getDefaultModelId();
    const hash = hashCacheKey({ scriptText: payload.scriptText, voiceId, modelId });

    const supabase = getSupabaseServiceClient();

    const { data: existing, error: lookupError } = await supabase
      .from("media_assets")
      .select("url, duration_seconds")
      .eq("hash", hash)
      .eq("type", "audio")
      .limit(1)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let audioUrl: string;
    let durationSeconds: number;

    if (existing) {
      logger.info("generate-audio cache hit", { newscastId: payload.newscastId });
      audioUrl = existing.url as string;
      durationSeconds = Number(existing.duration_seconds);
    } else {
      const audioBuffer = await ttsProvider.synthesize({
        text: payload.scriptText,
        voiceId,
        modelId,
      });

      const parsed = await parseBuffer(audioBuffer, { mimeType: "audio/mpeg" });
      durationSeconds = Math.round(parsed.format.duration ?? 0);

      const storagePath = `${payload.newscastId}/${hash}.mp3`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, audioBuffer, { contentType: "audio/mpeg", upsert: true });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
      audioUrl = publicUrlData.publicUrl;

      const { error: insertError } = await supabase.from("media_assets").insert({
        newscast_id: payload.newscastId,
        type: "audio",
        bucket: BUCKET,
        storage_path: storagePath,
        url: audioUrl,
        duration_seconds: durationSeconds,
        mime_type: "audio/mpeg",
        hash,
        metadata: { voiceId, modelId },
      });
      if (insertError) throw insertError;
    }

    await updateNewscastStatus(payload.newscastId, "generating_audio", {
      provider: "elevenlabs",
      metadata: { voiceId, modelId },
    });

    logger.info("generate-audio completed", {
      newscastId: payload.newscastId,
      durationSeconds,
      cached: Boolean(existing),
    });

    return { audioUrl, durationSeconds, hash };
  },
});
