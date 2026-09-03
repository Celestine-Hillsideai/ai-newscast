import { z } from "zod";
import { timelineEntrySchema } from "./verification.js";

/**
 * The shape summarize-news asks the LLM for, matching the spec's NEWS
 * SUMMARY section minus `sourceIds` — that field is computed in code from
 * the deduped article ids passed into this stage (they ARE the sources, by
 * definition), never asked of the model, to avoid hallucinated ids for
 * something already known deterministically.
 */
export const llmSummarySchema = z.object({
  headline: z.string(),
  dek: z.string(),
  summary: z.string(),
  whatHappened: z.string(),
  keyDevelopments: z.array(z.string()),
  whyItMatters: z.string(),
  whatWeKnow: z.array(z.string()),
  whatWeDoNotKnow: z.array(z.string()),
  timeline: z.array(timelineEntrySchema),
  confidenceScore: z.number().min(0).max(1),
});

export type LlmSummary = z.infer<typeof llmSummarySchema>;
