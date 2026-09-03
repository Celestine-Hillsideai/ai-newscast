import { logger } from "@trigger.dev/sdk/v3";
import type { DedupCandidate } from "./types.js";

/**
 * DEDUPLICATION layer 4 ("LLM event clustering where necessary") — the
 * fallback for articles that layers 1-3 (URL, content hash, lexical
 * similarity) couldn't confidently resolve. Deferred to Phase 3, which
 * introduces LLMProvider/OpenAIProvider; until then this is an inert
 * passthrough so the call site in deduplicate-news.ts doesn't need to change
 * when this is implemented for real.
 */
export async function clusterByLlm(candidates: DedupCandidate[]): Promise<DedupCandidate[]> {
  if (candidates.length > 0) {
    logger.info("clusterByLlm: passthrough (Phase 3 not yet implemented)", {
      candidateCount: candidates.length,
    });
  }
  return candidates;
}
