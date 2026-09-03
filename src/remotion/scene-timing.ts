export interface SceneDurations {
  intro: number;
  headline: number;
  keyDevelopments: number;
  timeline: number;
  whyItMatters: number;
  sources: number;
  outro: number;
}

const FIXED_SCENE_SECONDS = 3;
const MIDDLE_SCENE_COUNT = 5;

/**
 * Splits the total video length across the seven scenes: a fixed-length
 * Intro and Outro, with the remainder divided evenly across the five
 * content scenes. Pure function, shared between Root.tsx's calculateMetadata
 * (trivial there — it just needs the total) and Newscast.tsx (which needs
 * each individual scene's <Series.Sequence> length) so they can never drift
 * out of sync with each other.
 */
export function computeSceneDurationsInFrames(
  totalDurationInFrames: number,
  fps: number
): SceneDurations {
  const fixedFrames = Math.round(FIXED_SCENE_SECONDS * fps);
  const intro = Math.min(fixedFrames, totalDurationInFrames);
  const outro = Math.min(fixedFrames, Math.max(totalDurationInFrames - intro, 0));
  const remaining = Math.max(totalDurationInFrames - intro - outro, 0);

  const base = Math.floor(remaining / MIDDLE_SCENE_COUNT);
  const remainder = remaining - base * MIDDLE_SCENE_COUNT;
  const middle = Array.from({ length: MIDDLE_SCENE_COUNT }, (_, i) => base + (i < remainder ? 1 : 0));

  return {
    intro,
    headline: middle[0] ?? 0,
    keyDevelopments: middle[1] ?? 0,
    timeline: middle[2] ?? 0,
    whyItMatters: middle[3] ?? 0,
    sources: middle[4] ?? 0,
    outro,
  };
}
