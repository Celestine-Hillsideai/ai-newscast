import path from "node:path";
import type { NewscastVideoProps } from "../../remotion/types.js";

export interface RenderVideoParams {
  inputProps: NewscastVideoProps;
  outputPath: string;
}

export interface VideoRenderer {
  render(params: RenderVideoParams): Promise<void>;
}

const COMPOSITION_ID = "newscast";
const ENTRY_POINT = path.join(process.cwd(), "src", "remotion", "index.ts");

let cachedServeUrl: Promise<string> | undefined;

/**
 * Bundles once per container lifetime (bundle() is expensive and the
 * composition code never changes between renders — only inputProps do).
 * `@remotion/bundler` is dynamically imported here, not at module top
 * level: it eagerly pulls in webpack and other heavy dependencies, which
 * made Trigger.dev's own task-indexing step (which imports every task file
 * just to discover its exports, before any task runs) time out. Deferring
 * the import to first actual use keeps indexing fast.
 */
async function getServeUrl(): Promise<string> {
  if (!cachedServeUrl) {
    const { bundle } = await import("@remotion/bundler");
    cachedServeUrl = bundle({ entryPoint: ENTRY_POINT });
  }
  return cachedServeUrl;
}

/**
 * Renders via Remotion's Node SSR API (bundle -> selectComposition ->
 * renderMedia), per https://www.remotion.dev/docs/ssr-node. Calling bundle()
 * at runtime is fine in a long-running Node process per Remotion's own
 * guidance, as opposed to a restrictive serverless function — see
 * workflows/phase-5-video.md for the research behind this choice.
 */
export class RemotionVideoProvider implements VideoRenderer {
  async render({ inputProps, outputPath }: RenderVideoParams): Promise<void> {
    const { renderMedia, selectComposition } = await import("@remotion/renderer");
    const serveUrl = await getServeUrl();

    const composition = await selectComposition({
      serveUrl,
      id: COMPOSITION_ID,
      inputProps,
    });

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
    });
  }
}
