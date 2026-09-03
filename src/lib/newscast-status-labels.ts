import type { NewscastStatus } from "./schemas/newscast.js";

/**
 * Compact status labels for list/badge contexts (history page). The
 * generation page's progress list uses its own longer, narrated labels
 * (src/components/generate/generation-progress.tsx) — different job, same
 * underlying newscastStatusEnum values.
 */
export const STATUS_LABELS: Record<NewscastStatus, string> = {
  queued: "Queued",
  researching: "Discovering",
  extracting: "Extracting",
  deduplicating: "Deduplicating",
  verifying: "Verifying",
  summarizing: "Summarizing",
  scripting: "Scripting",
  generating_audio: "Narrating",
  generating_video: "Rendering",
  finalizing: "Finalizing",
  completed: "Completed",
  failed: "Failed",
};
