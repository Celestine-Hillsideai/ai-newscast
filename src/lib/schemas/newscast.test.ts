import { describe, expect, it } from "vitest";
import { generateNewscastPayloadSchema, topicInputSchema } from "./newscast.js";

describe("topicInputSchema", () => {
  it("rejects topics shorter than 3 characters", () => {
    expect(topicInputSchema.safeParse("ab").success).toBe(false);
  });

  it("rejects topics longer than 200 characters", () => {
    expect(topicInputSchema.safeParse("a".repeat(201)).success).toBe(false);
  });

  it("accepts a valid topic", () => {
    expect(topicInputSchema.safeParse("CBN interest rate decision").success).toBe(true);
  });
});

describe("generateNewscastPayloadSchema", () => {
  it("requires a valid uuid newscastId", () => {
    const result = generateNewscastPayloadSchema.safeParse({
      newscastId: "not-a-uuid",
      topic: "CBN interest rate decision",
    });
    expect(result.success).toBe(false);
  });
});
