import { z } from "zod";

/**
 * Matches the master spec's API section: POST /api/newscasts validates
 * topic as 3-200 characters.
 */
export const topicInputSchema = z.string().min(3).max(200);

/**
 * The twelve explicit UX states from the spec's FRONTEND UX STATES section.
 * Every task in src/trigger/ moves a newscast through these in order.
 */
export const newscastStatusEnum = z.enum([
  "queued",
  "researching",
  "extracting",
  "deduplicating",
  "verifying",
  "summarizing",
  "scripting",
  "generating_audio",
  "generating_video",
  "finalizing",
  "completed",
  "failed",
]);

export type NewscastStatus = z.infer<typeof newscastStatusEnum>;

export const generateNewscastPayloadSchema = z.object({
  newscastId: z.string().uuid(),
  topic: topicInputSchema,
});

export type GenerateNewscastPayload = z.infer<typeof generateNewscastPayloadSchema>;
