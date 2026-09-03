import { describe, expect, it } from "vitest";
import { llmPodcastScriptSchema } from "./podcast-script.js";

describe("llmPodcastScriptSchema", () => {
  it("accepts a well-formed script response", () => {
    expect(llmPodcastScriptSchema.safeParse({ scriptText: "Good day, this is..." }).success).toBe(
      true
    );
  });

  it("rejects a missing scriptText field", () => {
    expect(llmPodcastScriptSchema.safeParse({}).success).toBe(false);
  });

  it("rejects a non-string scriptText", () => {
    expect(llmPodcastScriptSchema.safeParse({ scriptText: 123 }).success).toBe(false);
  });
});
