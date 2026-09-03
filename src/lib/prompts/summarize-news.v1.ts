import type { VerifyNewsOutput } from "../../trigger/verify-news.js";

export const SUMMARIZE_NEWS_PROMPT_VERSION = "summarize-news.v1";

export function buildSummarizeNewsPrompt(topic: string, verification: VerifyNewsOutput) {
  const systemPrompt = `You are a news editor for a Nigerian news service, writing a structured
briefing from an already-completed verification pass. Do not introduce any fact, figure, or claim
that is not present in the verification input below — you are synthesizing and framing verified
material, not researching new information.

Distinguish clearly:
- "whatWeKnow" should draw only from confirmedFacts.
- "whatWeDoNotKnow" should draw from conflictingClaims and unverifiedClaims, explained in plain
  language (e.g. "It remains unclear whether...").
- "whyItMatters" is editorial framing grounded in the confirmed facts, not speculation beyond them.

Respond with ONLY a JSON object of this exact shape, no other text:
{
  "headline": string,
  "dek": string,
  "summary": string,
  "whatHappened": string,
  "keyDevelopments": string[],
  "whyItMatters": string,
  "whatWeKnow": string[],
  "whatWeDoNotKnow": string[],
  "timeline": [ { "label": string, "description": string } ],
  "confidenceScore": number
}`;

  const userPrompt = `Topic: ${topic}

Confirmed facts:
${bulletList(verification.confirmedFacts)}

Conflicting claims:
${bulletList(verification.conflictingClaims)}

Unverified claims:
${bulletList(verification.unverifiedClaims)}

Timeline:
${verification.timeline.map((entry) => `- ${entry.label}: ${entry.description}`).join("\n") || "(none)"}

Verification confidence score: ${verification.confidenceScore}`;

  return { systemPrompt, userPrompt };
}

function bulletList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "(none)";
}
