import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { OpenAIProvider } from "../lib/providers/llm.js";
import { llmSummarySchema } from "../lib/schemas/summary.js";
import {
  buildSummarizeNewsPrompt,
  SUMMARIZE_NEWS_PROMPT_VERSION,
} from "../lib/prompts/summarize-news.v1.js";
import { getCached, hashCacheKey, setCached } from "../lib/cache.js";
import type { VerifyNewsOutput } from "./verify-news.js";

export type SummarizeNewsPayload = {
  newscastId: string;
  topic: string;
  articleIds: string[];
  verification: VerifyNewsOutput;
};

export type SummarizeNewsOutput = {
  headline: string;
  dek: string;
  summary: string;
  whatHappened: string;
  keyDevelopments: string[];
  whyItMatters: string;
  whatWeKnow: string[];
  whatWeDoNotKnow: string[];
  timeline: Array<{ label: string; description: string }>;
  sourceIds: string[];
  confidenceScore: number;
};

const llmProvider = new OpenAIProvider();

/**
 * Structured JSON summary matching the spec's NEWS SUMMARY schema. `sourceIds`
 * is set from the deduped article ids passed in — these ARE this newscast's
 * sources by definition, so it's never asked of the LLM.
 * See AI_NewsCast_Coding_Agent_Master_Specification.txt: NEWS SUMMARY.
 */
export const summarizeNews = task({
  id: "summarize-news",
  run: async (payload: SummarizeNewsPayload): Promise<SummarizeNewsOutput> => {
    await updateNewscastStatus(payload.newscastId, "summarizing");
    logger.info("summarize-news started", { newscastId: payload.newscastId });

    const cacheKey = hashCacheKey({
      promptVersion: SUMMARIZE_NEWS_PROMPT_VERSION,
      topic: payload.topic,
      verification: payload.verification,
    });

    let llmSummary = await getCached<ReturnType<typeof llmSummarySchema.parse>>(cacheKey);
    if (!llmSummary) {
      const { systemPrompt, userPrompt } = buildSummarizeNewsPrompt(
        payload.topic,
        payload.verification
      );

      llmSummary = await llmProvider.generateJson({
        promptVersion: SUMMARIZE_NEWS_PROMPT_VERSION,
        systemPrompt,
        userPrompt,
        schema: llmSummarySchema,
      });
      await setCached(cacheKey, llmSummary);
    }

    const summary: SummarizeNewsOutput = { ...llmSummary, sourceIds: payload.articleIds };

    await updateNewscastStatus(payload.newscastId, "summarizing", {
      provider: "openai",
      metadata: { promptVersion: SUMMARIZE_NEWS_PROMPT_VERSION },
      patch: {
        headline: summary.headline,
        dek: summary.dek,
        summary: summary.summary,
        what_happened: summary.whatHappened,
        key_developments: summary.keyDevelopments,
        why_it_matters: summary.whyItMatters,
        what_we_know: summary.whatWeKnow,
        what_we_do_not_know: summary.whatWeDoNotKnow,
        timeline: summary.timeline,
        source_ids: summary.sourceIds,
        confidence_score: summary.confidenceScore,
      },
    });

    logger.info("summarize-news completed", { newscastId: payload.newscastId });

    return summary;
  },
});
