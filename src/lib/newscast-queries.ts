import type { SupabaseClient } from "@supabase/supabase-js";
import type { NewscastStatus } from "./schemas/newscast.js";

export type NewscastDetail = {
  id: string;
  topic: string;
  status: NewscastStatus;
  errorMessage: string | null;
  triggerRunId: string | null;
  headline: string | null;
  dek: string | null;
  summary: string | null;
  whatHappened: string | null;
  keyDevelopments: string[];
  whyItMatters: string | null;
  whatWeKnow: string[];
  whatWeDoNotKnow: string[];
  timeline: { label: string; description: string }[];
  confidenceScore: number | null;
  createdAt: string;
  completedAt: string | null;
  audio: { url: string; durationSeconds: number } | null;
  video: { url: string; durationSeconds: number } | null;
  sourceNames: string[];
};

type NewscastRow = {
  id: string;
  topic: string;
  status: NewscastStatus;
  error_message: string | null;
  trigger_run_id: string | null;
  headline: string | null;
  dek: string | null;
  summary: string | null;
  what_happened: string | null;
  key_developments: string[];
  why_it_matters: string | null;
  what_we_know: string[];
  what_we_do_not_know: string[];
  timeline: { label: string; description: string }[];
  confidence_score: number | null;
  created_at: string;
  completed_at: string | null;
};

/**
 * The one place the frontend reads a newscast's full detail — used by both
 * GET /api/newscasts/:id (the browser's only path to this data, per
 * workflows/architecture-communication.md section 4) and the result page's
 * server-side render, so the shape is defined once. Always goes through the
 * caller's own RLS-scoped session; never the service-role key.
 */
export async function getNewscastDetail(
  supabase: SupabaseClient,
  id: string
): Promise<NewscastDetail | null> {
  const { data: newscast, error } = await supabase
    .from("newscasts")
    .select(
      "id, topic, status, error_message, trigger_run_id, headline, dek, summary, what_happened, key_developments, why_it_matters, what_we_know, what_we_do_not_know, timeline, confidence_score, created_at, completed_at"
    )
    .eq("id", id)
    .maybeSingle<NewscastRow>();

  if (error) throw error;
  if (!newscast) return null;

  const { data: mediaAssets, error: mediaError } = await supabase
    .from("media_assets")
    .select("type, url, duration_seconds")
    .eq("newscast_id", id)
    .in("type", ["audio", "video"]);
  if (mediaError) throw mediaError;

  const audioAsset = mediaAssets?.find((asset) => asset.type === "audio");
  const videoAsset = mediaAssets?.find((asset) => asset.type === "video");

  const { data: articles, error: articlesError } = await supabase
    .from("articles")
    .select("news_sources(name)")
    .eq("newscast_id", id);
  if (articlesError) throw articlesError;

  const sourceNames = new Set<string>();
  for (const row of articles ?? []) {
    const source = row.news_sources as { name?: string } | null;
    if (source?.name) sourceNames.add(source.name);
  }

  return {
    id: newscast.id,
    topic: newscast.topic,
    status: newscast.status,
    errorMessage: newscast.error_message,
    triggerRunId: newscast.trigger_run_id,
    headline: newscast.headline,
    dek: newscast.dek,
    summary: newscast.summary,
    whatHappened: newscast.what_happened,
    keyDevelopments: newscast.key_developments ?? [],
    whyItMatters: newscast.why_it_matters,
    whatWeKnow: newscast.what_we_know ?? [],
    whatWeDoNotKnow: newscast.what_we_do_not_know ?? [],
    timeline: newscast.timeline ?? [],
    confidenceScore: newscast.confidence_score,
    createdAt: newscast.created_at,
    completedAt: newscast.completed_at,
    audio: audioAsset?.url
      ? { url: audioAsset.url, durationSeconds: Number(audioAsset.duration_seconds ?? 0) }
      : null,
    video: videoAsset?.url
      ? { url: videoAsset.url, durationSeconds: Number(videoAsset.duration_seconds ?? 0) }
      : null,
    sourceNames: [...sourceNames],
  };
}
