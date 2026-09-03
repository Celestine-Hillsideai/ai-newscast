import { getSupabaseServiceClient } from "./supabase.js";

export interface NewsSource {
  id: string;
  name: string;
  domain: string;
  homepageUrl: string;
  priority: number;
  trustScore: number;
}

/**
 * The registry from the spec's NEWS SOURCES section, seeded in
 * supabase/migrations/0001_init.sql. Used by discover-news to scope Tavily's
 * `include_domains`, and by extract-articles to attribute a discovered URL
 * back to a source (and its trust score, used later by deduplicate-news).
 */
export async function getEnabledNewsSources(): Promise<NewsSource[]> {
  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .from("news_sources")
    .select("id, name, domain, homepage_url, priority, trust_score")
    .eq("enabled", true)
    .order("priority", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    domain: row.domain as string,
    homepageUrl: row.homepage_url as string,
    priority: row.priority as number,
    trustScore: Number(row.trust_score),
  }));
}

/** Matches a URL's hostname back to a registered source, if any (subdomains included). */
export function findSourceForUrl(url: string, sources: NewsSource[]): NewsSource | null {
  let host: string;
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }

  return (
    sources.find((source) => {
      const domain = source.domain.toLowerCase().replace(/^www\./, "");
      return host === domain || host.endsWith(`.${domain}`);
    }) ?? null
  );
}
