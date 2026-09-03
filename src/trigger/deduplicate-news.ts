import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { getSupabaseServiceClient } from "../lib/supabase.js";
import { titleSimilarity } from "../lib/dedup/semantic-similarity.js";
import { clusterByLlm } from "../lib/dedup/llm-clustering.js";
import type { DedupCandidate } from "../lib/dedup/types.js";

export type DeduplicateNewsPayload = { newscastId: string; articleIds: string[] };
export type DeduplicateNewsOutput = { dedupedArticleIds: string[] };

const SIMILARITY_THRESHOLD = 0.75;
const DEFAULT_TRUST_SCORE = 0.8;

/** Groups candidates by `key(candidate)`, keeping the highest-trust member of each group. */
function keepBestPerGroup(
  candidates: DedupCandidate[],
  key: (candidate: DedupCandidate) => string,
  duplicatesOf: Map<string, string>
): DedupCandidate[] {
  const groups = new Map<string, DedupCandidate>();

  for (const candidate of candidates) {
    const groupKey = key(candidate);
    const existing = groups.get(groupKey);
    if (!existing) {
      groups.set(groupKey, candidate);
      continue;
    }
    const [winner, loser] =
      candidate.trustScore > existing.trustScore ? [candidate, existing] : [existing, candidate];
    groups.set(groupKey, winner);
    duplicatesOf.set(loser.id, winner.id);
  }

  return [...groups.values()];
}

/** Greedy clustering by pairwise title similarity, keeping the highest-trust member per cluster. */
function clusterBySimilarity(
  candidates: DedupCandidate[],
  duplicatesOf: Map<string, string>
): DedupCandidate[] {
  const remaining = [...candidates];
  const survivors: DedupCandidate[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift();
    if (!seed) break;

    const cluster = [seed];
    for (let i = remaining.length - 1; i >= 0; i -= 1) {
      const candidate = remaining[i];
      if (candidate && titleSimilarity(seed.title, candidate.title) >= SIMILARITY_THRESHOLD) {
        cluster.push(...remaining.splice(i, 1));
      }
    }

    const representative = cluster.reduce((best, candidate) =>
      candidate.trustScore > best.trustScore ? candidate : best
    );
    for (const candidate of cluster) {
      if (candidate.id !== representative.id) duplicatesOf.set(candidate.id, representative.id);
    }
    survivors.push(representative);
  }

  return survivors;
}

/**
 * Four-layer dedup: URL normalization, content/title hashing, lexical
 * similarity (a stand-in for semantic similarity — see
 * src/lib/dedup/semantic-similarity.ts), and LLM event clustering (deferred
 * to Phase 3 — see src/lib/dedup/llm-clustering.ts).
 * See AI_NewsCast_Coding_Agent_Master_Specification.txt: DEDUPLICATION.
 */
export const deduplicateNews = task({
  id: "deduplicate-news",
  run: async (payload: DeduplicateNewsPayload): Promise<DeduplicateNewsOutput> => {
    await updateNewscastStatus(payload.newscastId, "deduplicating");
    logger.info("deduplicate-news started", {
      newscastId: payload.newscastId,
      articleCount: payload.articleIds.length,
    });

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("articles")
      .select("id, normalized_url, content_hash, title, news_sources(trust_score)")
      .in("id", payload.articleIds);

    if (error) throw error;

    const candidates: DedupCandidate[] = (data ?? []).map((row) => {
      const source = row.news_sources as { trust_score?: number } | null;
      return {
        id: row.id as string,
        normalizedUrl: row.normalized_url as string,
        contentHash: (row.content_hash as string) ?? "",
        title: (row.title as string) ?? "",
        trustScore: Number(source?.trust_score ?? DEFAULT_TRUST_SCORE),
      };
    });

    const duplicatesOf = new Map<string, string>();

    const afterUrlDedup = keepBestPerGroup(candidates, (c) => c.normalizedUrl, duplicatesOf);
    const afterContentDedup = keepBestPerGroup(afterUrlDedup, (c) => c.contentHash, duplicatesOf);
    const afterSimilarityDedup = clusterBySimilarity(afterContentDedup, duplicatesOf);
    const survivors = await clusterByLlm(afterSimilarityDedup);

    if (duplicatesOf.size > 0) {
      await Promise.all(
        [...duplicatesOf.entries()].map(([duplicateId, representativeId]) =>
          supabase
            .from("articles")
            .update({
              status: "duplicate",
              rejection_reason: `duplicate_of:${representativeId}`,
            })
            .eq("id", duplicateId)
        )
      );
    }

    const dedupedArticleIds = survivors.map((candidate) => candidate.id);

    logger.info("deduplicate-news completed", {
      newscastId: payload.newscastId,
      before: candidates.length,
      after: dedupedArticleIds.length,
    });

    return { dedupedArticleIds };
  },
});
