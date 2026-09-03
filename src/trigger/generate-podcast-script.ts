import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { OpenAIProvider } from "../lib/providers/llm.js";
import { llmPodcastScriptSchema } from "../lib/schemas/podcast-script.js";
import {
  buildPodcastScriptPrompt,
  PODCAST_SCRIPT_PROMPT_VERSION,
} from "../lib/prompts/podcast-script.v3.js";
import { getCached, hashCacheKey, setCached } from "../lib/cache.js";
import type { SummarizeNewsOutput } from "./summarize-news.js";

export type GeneratePodcastScriptPayload = { newscastId: string; summary: SummarizeNewsOutput };
export type GeneratePodcastScriptOutput = { scriptText: string };

const llmProvider = new OpenAIProvider();

/**
 * A ~2 minute (260-320 word) professional spoken-news script, introducing no
 * facts absent from the verified briefing. Natural spoken language, not a
 * JSON readout. See AI_NewsCast_Coding_Agent_Master_Specification.txt: PODCAST.
 */
export const generatePodcastScript = task({
  id: "generate-podcast-script",
  run: async (payload: GeneratePodcastScriptPayload): Promise<GeneratePodcastScriptOutput> => {
    await updateNewscastStatus(payload.newscastId, "scripting");
    logger.info("generate-podcast-script started", { newscastId: payload.newscastId });

    const cacheKey = hashCacheKey({
      promptVersion: PODCAST_SCRIPT_PROMPT_VERSION,
      summary: payload.summary,
    });

    let result = await getCached<{ scriptText: string }>(cacheKey);
    if (!result) {
      const { systemPrompt, userPrompt } = buildPodcastScriptPrompt(payload.summary);
      result = await llmProvider.generateJson({
        promptVersion: PODCAST_SCRIPT_PROMPT_VERSION,
        systemPrompt,
        userPrompt,
        schema: llmPodcastScriptSchema,
      });
      await setCached(cacheKey, result);
    }

    await updateNewscastStatus(payload.newscastId, "scripting", {
      provider: "openai",
      metadata: { promptVersion: PODCAST_SCRIPT_PROMPT_VERSION },
    });

    logger.info("generate-podcast-script completed", {
      newscastId: payload.newscastId,
      wordCount: result.scriptText.split(/\s+/).filter(Boolean).length,
    });

    return { scriptText: result.scriptText };
  },
});
