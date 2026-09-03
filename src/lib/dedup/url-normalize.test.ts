import { describe, expect, it } from "vitest";
import { normalizeUrl } from "./url-normalize.js";

describe("normalizeUrl", () => {
  it("strips tracking params", () => {
    expect(normalizeUrl("https://punchng.com/story?utm_source=twitter&fbclid=abc")).toBe(
      "https://punchng.com/story"
    );
  });

  it("lowercases the host and drops www", () => {
    expect(normalizeUrl("https://WWW.Punchng.com/story")).toBe("https://punchng.com/story");
  });

  it("strips a trailing slash but keeps the root path", () => {
    expect(normalizeUrl("https://punchng.com/story/")).toBe("https://punchng.com/story");
    expect(normalizeUrl("https://punchng.com/")).toBe("https://punchng.com/");
  });

  it("drops the fragment", () => {
    expect(normalizeUrl("https://punchng.com/story#section-2")).toBe(
      "https://punchng.com/story"
    );
  });

  it("treats two URLs that differ only by tracking params as identical", () => {
    const a = normalizeUrl("https://punchng.com/story?utm_source=a&id=42");
    const b = normalizeUrl("https://punchng.com/story?id=42&utm_campaign=b");
    expect(a).toBe(b);
  });

  it("returns unparsable input unchanged", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});
