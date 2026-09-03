import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { getSupabaseServiceClient } from "../lib/supabase.js";
import { OpenAIProvider } from "../lib/providers/llm.js";
import { llmVerificationSchema, type LlmClaim } from "../lib/schemas/verification.js";
import { buildVerifyNewsPrompt, VERIFY_NEWS_PROMPT_VERSION } from "../lib/prompts/verify-news.v1.js";
import { getCached, hashCacheKey, setCached } from "../lib/cache.js";

export type VerifyNewsPayload = { newscastId: string; topic: string; dedupedArticleIds: string[] };
export type VerifyNewsOutput = {
  confirmedFacts: string[];
  conflictingClaims: string[];
  unverifiedClaims: string[];
  timeline: Array<{ label: string; description: string }>;
  confidenceScore: number;
};

const MIN_INDEPENDENT_SOURCES_FOR_CONFIRMED = 2;
const llmProvider = new OpenAIProvider();

interface CandidateArticle {
  id: string;
  title: string;
  content: string;
  contentHash: string;
  sourceId: string | null;
  sourceName: string;
  trustScore: number;
}

/**
 * Dedicated verification stage. The LLM proposes each claim's supporting
 * article ids and its own confirmed/conflicting/unverified guess, but this
 * function independently re-checks that any "confirmed" claim actually has
 * 2+ distinct sources behind it — the spec's corroboration rule is enforced
 * here in code, not left to the model's own judgment.
 * See AI_NewsCast_Coding_Agent_Master_Specification.txt: VERIFICATION.
 */
export const verifyNews = task({
  id: "verify-news",
  run: async (payload: VerifyNewsPayload): Promise<VerifyNewsOutput> => {
    await updateNewscastStatus(payload.newscastId, "verifying");
    logger.info("verify-news started", {
      newscastId: payload.newscastId,
      articleCount: payload.dedupedArticleIds.length,
    });

    const articles = await fetchCandidateArticles(payload.dedupedArticleIds);
    if (articles.length === 0) {
      throw new Error("verify-news: no articles available to verify");
    }

    const cacheKey = hashCacheKey({
      promptVersion: VERIFY_NEWS_PROMPT_VERSION,
      contentHashes: articles.map((a) => a.contentHash).sort(),
    });

    let llmResult = await getCached<{
      claims: LlmClaim[];
      timeline: VerifyNewsOutput["timeline"];
      confidenceScore: number;
    }>(cacheKey);

    if (!llmResult) {
      const { systemPrompt, userPrompt } = buildVerifyNewsPrompt(
        payload.topic,
        articles.map((a) => ({
          id: a.id,
          title: a.title,
          content: a.content,
          sourceName: a.sourceName,
          trustScore: a.trustScore,
        }))
      );

      llmResult = await llmProvider.generateJson({
        promptVersion: VERIFY_NEWS_PROMPT_VERSION,
        systemPrompt,
        userPrompt,
        schema: llmVerificationSchema,
      });
      await setCached(cacheKey, llmResult);
    }

    const articleSourceById = new Map(articles.map((a) => [a.id, a.sourceId ?? a.id]));

    const confirmedFacts: string[] = [];
    const conflictingClaims: string[] = [];
    const unverifiedClaims: string[] = [];

    for (const claim of llmResult.claims) {
      const distinctSources = new Set(
        claim.supportingArticleIds
          .filter((id) => articleSourceById.has(id))
          .map((id) => articleSourceById.get(id))
      );

      let status = claim.assessment;
      if (status === "confirmed" && distinctSources.size < MIN_INDEPENDENT_SOURCES_FOR_CONFIRMED) {
        status = "unverified";
      }

      if (status === "confirmed") confirmedFacts.push(claim.statement);
      else if (status === "conflicting") conflictingClaims.push(claim.statement);
      else unverifiedClaims.push(claim.statement);
    }

    await updateNewscastStatus(payload.newscastId, "verifying", {
      provider: "openai",
      metadata: { promptVersion: VERIFY_NEWS_PROMPT_VERSION },
    });

    logger.info("verify-news completed", {
      newscastId: payload.newscastId,
      confirmed: confirmedFacts.length,
      conflicting: conflictingClaims.length,
      unverified: unverifiedClaims.length,
    });

    return {
      confirmedFacts,
      conflictingClaims,
      unverifiedClaims,
      timeline: llmResult.timeline,
      confidenceScore: llmResult.confidenceScore,
    };
  },
});

async function fetchCandidateArticles(articleIds: string[]): Promise<CandidateArticle[]> {
  if (articleIds.length === 0) return [];

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("articles")
    .select("id, title, content, content_hash, source_id, news_sources(name, trust_score)")
    .in("id", articleIds);

  if (error) throw error;

  return (data ?? [])
    .filter((row) => row.content)
    .map((row) => {
      const source = row.news_sources as { name?: string; trust_score?: number } | null;
      return {
        id: row.id as string,
        title: (row.title as string) ?? "",
        content: row.content as string,
        contentHash: (row.content_hash as string) ?? "",
        sourceId: (row.source_id as string) ?? null,
        sourceName: source?.name ?? "Unknown source",
        trustScore: Number(source?.trust_score ?? 0.8),
      };
    });
}
