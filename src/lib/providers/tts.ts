import { fetchWithRetry } from "../http-retry.js";

export interface SynthesizeParams {
  text: string;
  voiceId: string;
  modelId: string;
}

export interface TextToSpeechProvider {
  /** Returns raw MP3 bytes. */
  synthesize(params: SynthesizeParams): Promise<Buffer>;
}

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // ElevenLabs' standard premade "Rachel" voice.
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

export function getDefaultVoiceId(): string {
  return process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
}

export function getDefaultModelId(): string {
  return process.env.ELEVENLABS_MODEL_ID ?? DEFAULT_MODEL_ID;
}

/**
 * Calls ElevenLabs' REST API directly via fetch (same reasoning as every
 * other provider in this project — visible/debuggable request-response
 * shape). This endpoint returns raw audio/mpeg bytes, not JSON, so there is
 * nothing to Zod-validate here.
 */
export class ElevenLabsProvider implements TextToSpeechProvider {
  async synthesize({ text, voiceId, modelId }: SynthesizeParams): Promise<Buffer> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) throw new Error("ELEVENLABS_API_KEY must be set (see .env.example).");

    const response = await fetchWithRetry(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({ text, model_id: modelId }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`ElevenLabs request failed (${response.status}): ${body}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}
