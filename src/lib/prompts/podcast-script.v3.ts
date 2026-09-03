import type { SummarizeNewsOutput } from "../../trigger/summarize-news.js";

export const PODCAST_SCRIPT_PROMPT_VERSION = "podcast-script.v3";

/**
 * v3: shortens the target from v2's 700-950 words (3-6 minutes) to 260-320
 * words (~2 minutes) — a deliberate product decision to cut ElevenLabs
 * synthesis cost per newscast, not a bug fix like v1 -> v2. Structure and
 * fact-fidelity rules are unchanged from v2; only the length requirement and
 * the instruction to prioritize the most important developments over full
 * coverage are new.
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
briefly note why it's unclear rather than dwelling on it at length.

Length is a hard requirement, not a suggestion: the script MUST be at least 260 words and should
not exceed 320 words. A script outside that range is unacceptable and will be rejected — keep the
body tight and cover only the most important key developments rather than every one.

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
