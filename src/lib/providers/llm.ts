import type { z } from "zod";
import { fetchWithRetry } from "../http-retry.js";

export interface GenerateJsonParams<T> {
  /** Recorded in generation_events.metadata per the spec's PROMPT VERSIONING section. */
  promptVersion: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
}

export interface LLMProvider {
  generateJson<T>(params: GenerateJsonParams<T>): Promise<T>;
}

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Calls OpenAI's Chat Completions API directly via fetch (same reasoning as
 * the Phase 2 providers: the raw request/response shape stays visible and
 * debuggable). Uses JSON mode + Zod validation; on an invalid response it
 * retries once with a corrective follow-up message before giving up, per the
 * spec's NEWS SUMMARY section ("Reject and retry ... on schema validation
 * failure").
 */
export class OpenAIProvider implements LLMProvider {
  async generateJson<T>({
    systemPrompt,
    userPrompt,
    schema,
  }: GenerateJsonParams<T>): Promise<T> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY must be set (see .env.example).");
    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    const first = await this.callOnce(apiKey, model, messages);
    const firstResult = this.tryValidate(first, schema);
    if (firstResult.ok) return firstResult.data;

    messages.push({ role: "assistant", content: first });
    messages.push({
      role: "user",
      content:
        "That response was invalid: " +
        firstResult.error +
        "\n\nReturn ONLY corrected JSON matching the required shape, no other text.",
    });

    const second = await this.callOnce(apiKey, model, messages);
    const secondResult = this.tryValidate(second, schema);
    if (secondResult.ok) return secondResult.data;

    throw new Error(`OpenAIProvider: response failed schema validation twice: ${secondResult.error}`);
  }

  private async callOnce(
    apiKey: string,
    model: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
  ): Promise<string> {
    const response = await fetchWithRetry("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI request failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("OpenAI response had no message content");
    return content;
  }

  private tryValidate<T>(
    raw: string,
    schema: z.ZodType<T>
  ): { ok: true; data: T } | { ok: false; error: string } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { ok: false, error: `not valid JSON: ${(error as Error).message}` };
    }

    const result = schema.safeParse(parsed);
    if (result.success) return { ok: true, data: result.data };
    return { ok: false, error: result.error.message };
  }
}
