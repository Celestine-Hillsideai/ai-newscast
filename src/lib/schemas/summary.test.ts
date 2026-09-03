import { describe, expect, it } from "vitest";
import { llmSummarySchema } from "./summary.js";

function validSummary() {
  return {
    headline: "CBN raises interest rate to 27.5%",
    dek: "Central bank tightens policy again",
    summary: "The Central Bank of Nigeria raised its benchmark rate...",
    whatHappened: "The MPC voted to raise the MPR.",
    keyDevelopments: ["Rate raised by 50bps"],
    whyItMatters: "Affects borrowing costs across the economy.",
    whatWeKnow: ["The new rate is 27.5%"],
    whatWeDoNotKnow: ["Whether further hikes are planned"],
    timeline: [{ label: "2026-08-30", description: "MPC meeting held" }],
    confidenceScore: 0.75,
  };
}

describe("llmSummarySchema", () => {
  it("accepts a well-formed summary", () => {
    expect(llmSummarySchema.safeParse(validSummary()).success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { headline, ...rest } = validSummary();
    void headline;
    expect(llmSummarySchema.safeParse(rest).success).toBe(false);
  });

  it("rejects a non-array keyDevelopments", () => {
    const invalid = { ...validSummary(), keyDevelopments: "not an array" };
    expect(llmSummarySchema.safeParse(invalid).success).toBe(false);
  });

  it("rejects an out-of-range confidence score", () => {
    const invalid = { ...validSummary(), confidenceScore: -0.1 };
    expect(llmSummarySchema.safeParse(invalid).success).toBe(false);
  });
});
