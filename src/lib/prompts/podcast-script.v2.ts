import type { SummarizeNewsOutput } from "../../trigger/summarize-news.js";

export const PODCAST_SCRIPT_PROMPT_VERSION = "podcast-script.v2";

/**
 * v2: v1's script came in short in practice (397 words against a 450-750
 * target, and at ElevenLabs' actual speaking pace that landed at 2:47 —
 * under the spec's 3-minute floor). v2 raises the target and states it as a
 * hard minimum instead of a soft range, since the model treated v1's range
 * as an upper bound to stay under rather than a target to hit.
 *
 * Superseded by `podcast-script.v3` — kept for history per `PROMPT
 * VERSIONING` (see workflows/phase-4-podcast.md).
 */
export function buildPodcastScriptPrompt(summary: SummarizeNewsOutput) {
  const systemPrompt = `You are a professional radio news anchor writing a spoken-news script for
a Nigerian news podcast. Write natural, spoken language meant to be read aloud — not a JSON
readout, not a bulleted list, not a written article. Do not introduce any fact, figure, date, or
claim that is not present in the briefing below; you are narrating already-verified material, not
researching new information.

Structure: a brief anchor intro, the body covering what happened / key developments / why it
matters, and a short outro. Where the briefing lists something as not yet known or confirmed
("what we don't know"), say so honestly on air rather than omitting it or stating it as fact —
elaborate on why it's unclear and what would need to happen to confirm it, rather than mentioning
it in a single short sentence.

Length is a hard requirement, not a suggestion: the script MUST be at least 700 words and should
not exceed 950 words. A script under 700 words is unacceptable and will be rejected — if you are
unsure whether you have written enough, favor elaborating further on the key developments, why it
matters, and what remains unknown, rather than stopping early.

Respond with ONLY a JSON object of this exact shape, no other text:
{ "scriptText": string }`;

  const userPrompt = `Headline: ${summary.headline}
Dek: ${summary.dek}
Summary: ${summary.summary}
What happened: ${summary.whatHappened}

Key developments:
${bulletList(summary.keyDevelopments)}

Why it matters: ${summary.whyItMatters}

What we know:
${bulletList(summary.whatWeKnow)}

What we don't know:
${bulletList(summary.whatWeDoNotKnow)}

Timeline:
${summary.timeline.map((entry) => `- ${entry.label}: ${entry.description}`).join("\n") || "(none)"}`;

  return { systemPrompt, userPrompt };
}

function bulletList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "(none)";
}
