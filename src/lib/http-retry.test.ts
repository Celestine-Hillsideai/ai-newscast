import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithRetry } from "./http-retry.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe("fetchWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns immediately on success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1 });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 and succeeds on a later attempt", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: "rate limited" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1 });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-retryable status like 404", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(404, { error: "not found" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://example.com", {}, { baseDelayMs: 1 });

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("gives up after maxAttempts and returns the last failed response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503, { error: "unavailable" }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry(
      "https://example.com",
      {},
      { baseDelayMs: 1, maxAttempts: 3 }
    );

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
