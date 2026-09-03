const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "amp",
]);

/**
 * Normalizes a URL for duplicate detection (spec's DEDUPLICATION layer 1 and
 * NEWS PROCESSING's "normalize URLs"): lowercases the host, drops the
 * fragment and known tracking params, sorts remaining params, and strips a
 * trailing slash. Returns the original (trimmed) string if it isn't a valid
 * URL rather than throwing — callers treat unparsable URLs as their own
 * normalized form.
 */
export function normalizeUrl(rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return rawUrl.trim();
  }

  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  url.hash = "";

  const keptParams = [...url.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  url.search = "";
  for (const [key, value] of keptParams) {
    url.searchParams.append(key, value);
  }

  let pathname = url.pathname.replace(/\/+$/, "");
  if (pathname === "") pathname = "/";
  url.pathname = pathname;

  return url.toString();
}
