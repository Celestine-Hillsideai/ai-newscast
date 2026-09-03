import { createHash } from "node:crypto";

/**
 * Normalizes text (case/whitespace-insensitive) and hashes it, for exact
 * duplicate detection (spec's DEDUPLICATION layer 2: "content/title
 * hashing") and for the `articles.content_hash` column.
 */
export function hashContent(text: string): string {
  const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}
