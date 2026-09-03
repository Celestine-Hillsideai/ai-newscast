import { logger, task } from "@trigger.dev/sdk/v3";
import { updateNewscastStatus } from "../lib/newscast-status.js";
import { getSupabaseServiceClient } from "../lib/supabase.js";
import { getEnabledNewsSources, findSourceForUrl } from "../lib/news-sources.js";
import { normalizeUrl } from "../lib/dedup/url-normalize.js";
import { hashContent } from "../lib/dedup/content-hash.js";
import {
  FirecrawlArticleProvider,
  type ExtractedArticle,
} from "../lib/providers/article-extraction.js";
import { getCached, hashCacheKey, setCached } from "../lib/cache.js";

export type ExtractArticlesPayload = { newscastId: string; discoveredUrls: string[] };
export type ExtractArticlesOutput = { articleIds: string[] };

const extractionProvider = new FirecrawlArticleProvider();

/**
 * Extract full article content for each discovered URL and reject unusable
 * extraction results (empty/too-short/paywalled). Every attempt is persisted
 * to `articles` (accepted or rejected) for auditability; only accepted ids
 * are returned to the orchestrator.
 * See AI_NewsCast_Coding_Agent_Master_Specification.txt: NEWS PROCESSING.
 */
export const extractArticles = task({
  id: "extract-articles",
  run: async (payload: ExtractArticlesPayload): Promise<ExtractArticlesOutput> => {
    await updateNewscastStatus(payload.newscastId, "extracting");
    logger.info("extract-articles started", {
      newscastId: payload.newscastId,
      urlCount: payload.discoveredUrls.length,
    });

    const supabase = getSupabaseServiceClient();
    const sources = await getEnabledNewsSources();
    const articleIds: string[] = [];

    for (const url of payload.discoveredUrls) {
      const normalizedUrl = normalizeUrl(url);
      const cacheKey = hashCacheKey({ provider: "firecrawl", url: normalizedUrl });

      let article: ExtractedArticle | null = null;
      let rejectionReason: string | null = null;

      const cached = await getCached<ExtractedArticle>(cacheKey);
      if (cached) {
        article = cached;
      } else {
        const result = await extractionProvider.extract(url);
        if (result.ok) {
          article = result.article;
          await setCached(cacheKey, article);
        } else {
          rejectionReason = result.reason;
        }
      }

      const source = findSourceForUrl(url, sources);

      const { data, error } = await supabase
        .from("articles")
        .insert({
          newscast_id: payload.newscastId,
          source_id: source?.id ?? null,
          url,
          normalized_url: normalizedUrl,
          title: article?.title ?? null,
          content: article?.content ?? null,
          published_at: article?.publishedAt ?? null,
          extracted_at: new Date().toISOString(),
          content_hash: article ? hashContent(article.content) : null,
          status: article ? "extracted" : "rejected",
          rejection_reason: rejectionReason,
        })
        .select("id")
        .single();

      if (error) {
        logger.error("extract-articles: failed to persist article", {
          newscastId: payload.newscastId,
          url,
          error: error.message,
        });
        continue;
      }

      if (article) articleIds.push(data.id as string);
    }

    logger.info("extract-articles completed", {
      newscastId: payload.newscastId,
      attempted: payload.discoveredUrls.length,
      accepted: articleIds.length,
    });

    return { articleIds };
  },
});
