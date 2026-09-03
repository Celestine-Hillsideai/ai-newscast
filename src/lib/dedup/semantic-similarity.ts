const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "in", "on", "at", "to", "for",
  "with", "as", "by", "is", "are", "was", "were", "be", "it", "its", "this",
  "that", "from", "over", "after", "before", "amid", "amidst",
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      // Keep single-digit tokens (e.g. the "5" in "27.5") — numbers are
      // often the whole point of distinguishing two headlines — but still
      // drop other stray single characters and stopwords.
      .filter((word) => (word.length > 1 || /^\d$/.test(word)) && !STOPWORDS.has(word))
  );
}

/**
 * Token-set Jaccard similarity, 0-1. This is a lexical stand-in for the
 * spec's DEDUPLICATION layer 3 ("semantic similarity") — cheap, no external
 * API call, no OPENAI_API_KEY required. Phase 3 can swap this for embedding
 * cosine-similarity once LLMProvider exists, without changing call sites
 * (see src/trigger/deduplicate-news.ts).
 */
export function titleSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const word of setA) {
    if (setB.has(word)) intersectionSize += 1;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}
