import { describe, expect, it } from "vitest";
import { llmVerificationSchema } from "./verification.js";

describe("llmVerificationSchema", () => {
  it("accepts a well-formed verification response", () => {
    const result = llmVerificationSchema.safeParse({
      claims: [
        { statement: "CBN raised the MPR to 27.5%", supportingArticleIds: ["a1", "a2"], assessment: "confirmed" },
      ],
      timeline: [{ label: "2026-08-30", description: "CBN announces rate decision" }],
      confidenceScore: 0.8,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing field", () => {
    const result = llmVerificationSchema.safeParse({
      claims: [{ statement: "x", supportingArticleIds: [] }], // missing assessment
      timeline: [],
      confidenceScore: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid assessment enum value", () => {
    const result = llmVerificationSchema.safeParse({
      claims: [{ statement: "x", supportingArticleIds: [], assessment: "maybe" }],
      timeline: [],
      confidenceScore: 0.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range confidence score", () => {
    const result = llmVerificationSchema.safeParse({
      claims: [],
      timeline: [],
      confidenceScore: 1.5,
    });
    expect(result.success).toBe(false);
  });
});
