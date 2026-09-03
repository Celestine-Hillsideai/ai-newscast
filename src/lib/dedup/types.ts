/** The shape every dedup layer in src/lib/dedup/ and src/trigger/deduplicate-news.ts operates on. */
export interface DedupCandidate {
  id: string;
  normalizedUrl: string;
  contentHash: string;
  title: string;
  trustScore: number;
}
