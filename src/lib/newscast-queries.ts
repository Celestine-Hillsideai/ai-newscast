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
  sources: { title: string; url: string; sourceName: string | null }[];
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
  source_ids: string[];
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
      "id, topic, status, error_message, trigger_run_id, headline, dek, summary, what_happened, key_developments, why_it_matters, what_we_know, what_we_do_not_know, timeline, confidence_score, created_at, completed_at, source_ids"
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

  // Scoped to source_ids (the deduped, verified articles the summary was
  // actually built from) — not every row under this newscast_id, which would
  // also include articles rejected during dedup/verification.
  const sourceIds = newscast.source_ids ?? [];
  const { data: articles, error: articlesError } =
    sourceIds.length > 0
      ? await supabase
          .from("articles")
          .select("title, url, news_sources(name)")
          .in("id", sourceIds)
      : { data: [], error: null };
  if (articlesError) throw articlesError;

  const sources = (articles ?? [])
    .filter((article): article is typeof article & { title: string; url: string } =>
      Boolean(article.title && article.url)
    )
    .map((article) => ({
      title: article.title,
      url: article.url,
      sourceName: (article.news_sources as { name?: string } | null)?.name ?? null,
    }));

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
    sources,
  };
}

export type NewscastSummary = {
  id: string;
  topic: string;
  status: NewscastStatus;
  headline: string | null;
  createdAt: string;
  completedAt: string | null;
};

/**
 * The history page's data source, also exposed via GET /api/newscasts.
 * RLS (newscasts_select_own) already scopes this to the caller's own rows —
 * no explicit user_id filter needed here.
 */
export async function listNewscasts(
  supabase: SupabaseClient,
  limit = 50
): Promise<NewscastSummary[]> {
  const { data, error } = await supabase
    .from("newscasts")
    .select("id, topic, status, headline, created_at, completed_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    topic: row.topic,
    status: row.status,
    headline: row.headline,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }));
}
