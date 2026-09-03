import { z } from "zod";

/**
 * The shape verify-news asks the LLM for and Zod-validates the raw response
 * against, per PROMPT VERSIONING ("Zod schemas everywhere"). `assessment` is
 * the model's own guess — src/trigger/verify-news.ts independently re-checks
 * any "confirmed" claim actually has 2+ distinct sources before trusting it,
 * per the spec's VERIFICATION section ("Do not classify a claim as confirmed
 * merely because one low-quality source reported it").
 */
export const timelineEntrySchema = z.object({
  label: z.string(),
  description: z.string(),
});

export const llmClaimSchema = z.object({
  statement: z.string(),
  supportingArticleIds: z.array(z.string()),
  assessment: z.enum(["confirmed", "conflicting", "unverified"]),
});

export const llmVerificationSchema = z.object({
  claims: z.array(llmClaimSchema),
  timeline: z.array(timelineEntrySchema),
  confidenceScore: z.number().min(0).max(1),
});

export type LlmClaim = z.infer<typeof llmClaimSchema>;
export type LlmVerification = z.infer<typeof llmVerificationSchema>;
