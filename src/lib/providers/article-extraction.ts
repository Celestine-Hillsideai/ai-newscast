import { fetchWithRetry } from "../http-retry.js";

export interface ExtractedArticle {
  url: string;
  title: string;
  content: string;
  publishedAt?: string;
}

export type ExtractionResult =
  | { ok: true; article: ExtractedArticle }
  | { ok: false; reason: string };

export interface ArticleExtractionProvider {
  extract(url: string): Promise<ExtractionResult>;
}

const MIN_CONTENT_LENGTH = 200;

interface FirecrawlScrapeResponse {
  success?: boolean;
  error?: string;
  data?: {
    markdown?: string;
    metadata?: {
      title?: string;
      publishedTime?: string;
    };
  };
}

/**
 * Calls Firecrawl's REST API directly (no SDK), same reasoning as
 * TavilySearchProvider: the raw response shape stays visible and debuggable.
 * Rejects (returns { ok: false }) rather than throwing for unusable results,
 * per the spec's NEWS PROCESSING section ("Reject unusable article
 * extraction results") — a single bad URL shouldn't fail the whole task.
 */
export class FirecrawlArticleProvider implements ArticleExtractionProvider {
  async extract(url: string): Promise<ExtractionResult> {
    const apiKey = process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error("FIRECRAWL_API_KEY must be set (see .env.example).");

    let response: Response;
    try {
      response = await fetchWithRetry(
        "https://api.firecrawl.dev/v1/scrape",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({ url, formats: ["markdown"] }),
        },
        { baseDelayMs: 5000 } // Firecrawl's free tier is a per-minute cap; give it room to reset.
      );
    } catch (error) {
      return { ok: false, reason: `network error: ${(error as Error).message}` };
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, reason: `Firecrawl returned ${response.status}: ${body}` };
    }

    const data = (await response.json()) as FirecrawlScrapeResponse;

    if (!data.success) {
      return { ok: false, reason: data.error ?? "Firecrawl reported failure" };
    }

    const markdown = data.data?.markdown?.trim() ?? "";
    if (markdown.length < MIN_CONTENT_LENGTH) {
      return { ok: false, reason: `content too short (${markdown.length} chars)` };
    }

    return {
      ok: true,
      article: {
        url,
        title: data.data?.metadata?.title ?? url,
        content: markdown,
        publishedAt: data.data?.metadata?.publishedTime,
      },
    };
  }
}
