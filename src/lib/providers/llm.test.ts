import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { OpenAIProvider } from "./llm.js";

const schema = z.object({ foo: z.string() });

function chatResponse(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
}

describe("OpenAIProvider.generateJson", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "test-key";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENAI_API_KEY;
  });

  it("returns validated data on the first valid response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse(JSON.stringify({ foo: "bar" })));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider();
    const result = await provider.generateJson({
      promptVersion: "test.v1",
      systemPrompt: "system",
      userPrompt: "user",
      schema,
    });

    expect(result).toEqual({ foo: "bar" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with a corrective message and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ wrong: "shape" })))
      .mockResolvedValueOnce(chatResponse(JSON.stringify({ foo: "corrected" })));
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider();
    const result = await provider.generateJson({
      promptVersion: "test.v1",
      systemPrompt: "system",
      userPrompt: "user",
      schema,
    });

    expect(result).toEqual({ foo: "corrected" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws a clear error if the retry also fails validation", async () => {
    // mockImplementation (not mockResolvedValue) so each call gets a fresh
    // Response — a body can only be read once.
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(chatResponse(JSON.stringify({ wrong: "shape" })))
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIProvider();
    await expect(
      provider.generateJson({
        promptVersion: "test.v1",
        systemPrompt: "system",
        userPrompt: "user",
        schema,
      })
    ).rejects.toThrow(/failed schema validation twice/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws if OPENAI_API_KEY is not set", async () => {
    delete process.env.OPENAI_API_KEY;
    const provider = new OpenAIProvider();
    await expect(
      provider.generateJson({ promptVersion: "test.v1", systemPrompt: "s", userPrompt: "u", schema })
    ).rejects.toThrow(/OPENAI_API_KEY/);
  });
});
