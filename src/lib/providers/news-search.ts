import { fetchWithRetry } from "../http-retry.js";

export interface NewsSearchResult {
  url: string;
  title: string;
  snippet?: string;
  publishedAt?: string;
}

export interface NewsSearchOptions {
  includeDomains?: string[];
  maxResults?: number;
}

export interface NewsSearchProvider {
  search(query: string, options?: NewsSearchOptions): Promise<NewsSearchResult[]>;
}

interface TavilySearchResponse {
  results?: Array<{
    url?: string;
    title?: string;
    content?: string;
    published_date?: string;
  }>;
}

/**
 * Calls Tavily's REST API directly (no SDK) so the exact request/response
 * shape stays visible and easy to debug against the live API, rather than
 * trusting an assumed SDK surface.
 */
export class TavilySearchProvider implements NewsSearchProvider {
  async search(query: string, options: NewsSearchOptions = {}): Promise<NewsSearchResult[]> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) throw new Error("TAVILY_API_KEY must be set (see .env.example).");

    const response = await fetchWithRetry("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "advanced",
        max_results: options.maxResults ?? 10,
        ...(options.includeDomains?.length ? { include_domains: options.includeDomains } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Tavily search failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as TavilySearchResponse;

    const results: NewsSearchResult[] = [];
    for (const result of data.results ?? []) {
      if (!result.url || !result.title) continue;
      results.push({
        url: result.url,
        title: result.title,
        snippet: result.content,
        publishedAt: result.published_date,
      });
    }
    return results;
  }
}
