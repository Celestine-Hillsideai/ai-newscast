import { describe, expect, it } from "vitest";
import { titleSimilarity } from "./semantic-similarity.js";

describe("titleSimilarity", () => {
  it("scores near-identical titles highly", () => {
    const score = titleSimilarity(
      "CBN raises interest rate to 27.5 percent",
      "CBN raises interest rates to 27.5%"
    );
    expect(score).toBeGreaterThan(0.6);
  });

  it("scores unrelated titles low", () => {
    const score = titleSimilarity(
      "CBN raises interest rate to 27.5 percent",
      "Super Eagles qualify for AFCON final"
    );
    expect(score).toBeLessThan(0.2);
  });

  it("returns 0 for empty input", () => {
    expect(titleSimilarity("", "something")).toBe(0);
  });
});
