import { describe, expect, it } from "vitest";
import { computeSceneDurationsInFrames } from "./scene-timing";

function sum(d: ReturnType<typeof computeSceneDurationsInFrames>): number {
  return d.intro + d.headline + d.keyDevelopments + d.timeline + d.whyItMatters + d.sources + d.outro;
}

describe("computeSceneDurationsInFrames", () => {
  it("sums exactly to the total for an evenly-divisible duration", () => {
    const fps = 30;
    const total = 300 * fps; // 5 minutes
    expect(sum(computeSceneDurationsInFrames(total, fps))).toBe(total);
  });

  it("sums exactly to the total for durations that don't divide evenly by 5", () => {
    const fps = 30;
    for (const seconds of [181, 200, 233, 359, 267.5]) {
      const total = Math.round(seconds * fps);
      expect(sum(computeSceneDurationsInFrames(total, fps))).toBe(total);
    }
  });

  it("keeps every scene duration non-negative even for an artificially short total", () => {
    const fps = 30;
    const total = 4 * fps; // shorter than intro+outro would normally take
    const d = computeSceneDurationsInFrames(total, fps);
    for (const value of Object.values(d)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(sum(d)).toBe(total);
  });
});
