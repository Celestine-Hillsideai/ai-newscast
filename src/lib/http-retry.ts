const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * fetch wrapper that retries transient failures (429, 5xx) with exponential
 * backoff, per the spec's ERROR HANDLING section: "Retry transient failures:
 * 429, 500, 502, 503, 504. Do not blindly retry: 400, 401, 403, 404."
 * Non-retryable statuses (and the final attempt, whatever it returns) are
 * returned as-is for the caller to inspect/reject.
 */
export async function fetchWithRetry(
  input: string,
  init: RequestInit,
  options: { maxAttempts?: number; baseDelayMs?: number } = {}
): Promise<Response> {
  const maxAttempts = options.maxAttempts ?? 4;
  const baseDelayMs = options.baseDelayMs ?? 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(input, init);

    if (response.ok || !RETRYABLE_STATUSES.has(response.status) || attempt === maxAttempts) {
      return response;
    }

    await response.text().catch(() => undefined); // drain the body before discarding
    const delayMs = baseDelayMs * 2 ** (attempt - 1);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  // Unreachable — the loop always returns by the final attempt — but keeps TS happy.
  throw new Error("fetchWithRetry: exhausted attempts without a response");
}
