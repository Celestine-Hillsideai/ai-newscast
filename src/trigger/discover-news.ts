import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { getEnabledNewsSources } from "../lib/news-sources.js";
import { normalizeUrl } from "../lib/dedup/url-normalize.js";
import { TavilySearchProvider, type NewsSearchResult } from "../lib/providers/news-search.js";
import { getCached, hashCacheKey, setCached } from "../lib/cache.js";

export type DiscoverNewsPayload = { newscastId: string; topic: string };
export type DiscoverNewsOutput = { discoveredUrls: string[] };

const searchProvider = new TavilySearchProvider();

/**
 * Search multiple queries per topic (a registry-scoped query + a broad
 * query), normalize URLs, drop duplicate URLs.
 * See AI_NewsCast_Coding_Agent_Master_Specification.txt: NEWS PROCESSING, NEWS SOURCES.
 */
export const discoverNews = task({
  id: "discover-news",
  run: async (payload: DiscoverNewsPayload): Promise<DiscoverNewsOutput> => {
    await updateNewscastStatus(payload.newscastId, "researching");
    logger.info("discover-news started", { newscastId: payload.newscastId, topic: payload.topic });

    const sources = await getEnabledNewsSources();
    const domains = sources.map((source) => source.domain);

    const cacheKey = hashCacheKey({ provider: "tavily", topic: payload.topic, domains });
    const cached = await getCached<NewsSearchResult[]>(cacheKey);

    let results: NewsSearchResult[];
    if (cached) {
      logger.info("discover-news cache hit", { newscastId: payload.newscastId });
      results = cached;
    } else {
      const [scoped, broad] = await Promise.all([
        searchProvider.search(payload.topic, { includeDomains: domains, maxResults: 10 }),
        searchProvider.search(`${payload.topic} Nigeria`, { maxResults: 10 }),
      ]);
      results = [...scoped, ...broad];
      await setCached(cacheKey, results);
    }

    const seen = new Set<string>();
    const discoveredUrls: string[] = [];
    for (const result of results) {
      const normalized = normalizeUrl(result.url);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      discoveredUrls.push(result.url);
    }

    logger.info("discover-news completed", {
      newscastId: payload.newscastId,
      sourceCount: domains.length,
      discoveredCount: discoveredUrls.length,
    });

    return { discoveredUrls };
  },
});
