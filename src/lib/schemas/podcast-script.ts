import { z } from "zod";

/**
 * The (trivial) shape asked of the LLM for the podcast script, via the same
 * JSON-mode LLMProvider infrastructure used in Phase 3 — reused rather than
 * adding a second "plain text" code path to OpenAIProvider.
 */
export const llmPodcastScriptSchema = z.object({
  scriptText: z.string(),
});

export type LlmPodcastScript = z.infer<typeof llmPodcastScriptSchema>;
