export const VERIFY_NEWS_PROMPT_VERSION = "verify-news.v1";

const MAX_CONTENT_CHARS = 3000;
const MAX_ARTICLES = 12;

export interface VerifyNewsArticleInput {
  id: string;
  title: string;
  content: string;
  sourceName: string;
  trustScore: number;
}

export function buildVerifyNewsPrompt(topic: string, articles: VerifyNewsArticleInput[]) {
  // Cap article count and per-article length to bound token cost — prefer
  // the most trustworthy sources when there are more candidates than the cap.
  const selected = [...articles]
    .sort((a, b) => b.trustScore - a.trustScore)
    .slice(0, MAX_ARTICLES);

  const articleBlocks = selected
    .map((article) => {
      const content = article.content.slice(0, MAX_CONTENT_CHARS);
      return [
        `Article id: ${article.id}`,
        `Source: ${article.sourceName} (trust score: ${article.trustScore.toFixed(2)})`,
        `Title: ${article.title}`,
        `Content: ${content}`,
      ].join("\n");
    })
    .join("\n\n---\n\n");

  const systemPrompt = `You are a rigorous news verification editor for a Nigerian news service.
Your job is to extract factual claims from the provided articles about one topic and assess how
well-corroborated each claim is.

Rules:
- A claim may only be marked "confirmed" if it is reported by at least 2 articles from different,
  independent sources. Never mark a claim "confirmed" because a single source reported it, no
  matter how trustworthy that source is.
- If sources disagree on a claim (contradictory figures, outcomes, or framing), mark it
  "conflicting", not "confirmed".
- If a claim appears in only one article, mark it "unverified".
- For every claim, list the exact "Article id" values (given in the input) of every article that
  reports it, in "supportingArticleIds".
- Also produce a chronological timeline of the key events described across the articles.
- Also produce an overall confidenceScore from 0 to 1 reflecting how well-corroborated this topic
  is as a whole.

Respond with ONLY a JSON object of this exact shape, no other text:
{
  "claims": [
    { "statement": string, "supportingArticleIds": string[], "assessment": "confirmed" | "conflicting" | "unverified" }
  ],
  "timeline": [ { "label": string, "description": string } ],
  "confidenceScore": number
}`;

  const userPrompt = `Topic: ${topic}

Articles:

${articleBlocks}`;

  return { systemPrompt, userPrompt };
}
