import { defineConfig } from "@trigger.dev/sdk/v3";
import { additionalFiles, aptGet } from "@trigger.dev/build/extensions/core";
import type { BuildExtension } from "@trigger.dev/core/v3/build";

/**
 * Downloads Remotion's Chrome Headless Shell into the image at build time
 * instead of leaving it to a lazy runtime download on a container's first
 * generate-video call. This is a custom extension (no built-in Remotion one
 * exists) modeled on aptGet()'s addLayer() pattern.
 *
 * Verified against the CLI's own source (node_modules/trigger.dev/dist/esm/
 * deploy/buildImage.js and .../build/extensions.js), not assumed from docs:
 * a layer's `commands` become `RUN` steps inserted after `npm i` and after
 * `COPY . .` in the `build` stage, so @remotion/renderer is already
 * require()-able. @remotion/renderer resolves its download cache to
 * <project-root>/node_modules/.remotion (see getDownloadsCacheDir() in
 * @remotion/renderer/dist/esm/index.mjs), which the final image stage
 * already copies wholesale via `COPY --from=build .../node_modules
 * ./node_modules` — so nothing else needs to change to ship the binary.
 * ensureBrowser() only checks a version marker and downloads if missing; it
 * doesn't execute the binary, so it doesn't need the aptGet Chromium libs at
 * build time (those land in the `base` image the `build` stage extends from
 * anyway, so they're present at render time regardless).
 */
function prewarmRemotionChrome(): BuildExtension {
  return {
    name: "prewarm-remotion-chrome",
    onBuildComplete(context) {
      if (context.target === "dev") {
        return;
      }
      context.logger.debug("Pre-downloading Remotion's Chrome Headless Shell into the image");
      context.addLayer({
        id: "prewarm-remotion-chrome",
        commands: [
          `node -e "require('@remotion/renderer').ensureBrowser().then(() => console.log('Chrome Headless Shell pre-cached')).catch((e) => { console.error(e); process.exit(1); })"`,
        ],
      });
    },
  };
}

export default defineConfig({
  // Paste your real project ref here from the Trigger.dev dashboard
  // (Project settings -> Project ref). This is not a secret.
  project: "proj_chpbrlkwrssoomkzcvvc",
  runtime: "node",
  logLevel: "info",
  // 30 min, not the previous 600s: a cold container's first generate-video call pays for
  // Remotion's one-time bundle() step AND (if not yet cached) the Chrome Headless Shell
  // download in the same run. A local test that already had the browser cached still took
  // 9m37s for bundle+render alone, and a real prod run hit MAX_DURATION_EXCEEDED at 600s —
  // see workflows/phase-5-video.md.
  maxDuration: 1800,
  dirs: ["./src/trigger"],
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 30000,
      factor: 2,
      randomize: true,
    },
  },
  build: {
    // @remotion/bundler embeds its own webpack/rspack internals, which
    // choke Trigger.dev's own bundler when it statically processes
    // generate-video.ts's imports (observed: "TypeError: Assignment to
    // constant variable" inside @rspack/binding while Trigger.dev tried to
    // bundle @remotion/bundler/dist/rspack-config.js). Marking these
    // external leaves them as real node_modules requires at runtime instead
    // — see https://www.remotion.dev/docs/troubleshooting/bundling-bundle
    // ("Calling bundle() in bundled code").
    external: ["@remotion/bundler", "@remotion/renderer"],
    extensions: [
      // `RemotionVideoProvider` calls @remotion/bundler's bundle() with a
      // runtime file path (process.cwd()-relative), not a static import —
      // Trigger.dev's build only ships files it can see via static import
      // analysis, so src/remotion/** was silently missing from the deployed
      // image (observed: "ENOENT: no such file or directory,
      // open '/app/src/remotion/index.ts'" on the first real production
      // generate-video run). additionalFiles ships it explicitly.
      additionalFiles({ files: ["src/remotion/**/*"] }),
      // Remotion's Chrome Headless Shell (downloaded lazily on first render,
      // not via a package postinstall) needs these Linux shared libraries.
      // See https://www.remotion.dev/docs/miscellaneous/linux-dependencies
      // (Debian list — Trigger.dev's build image is Debian Bookworm).
      aptGet({
        packages: [
          "libnss3",
          "libdbus-1-3",
          "libatk1.0-0",
          "libgbm-dev",
          "libasound2",
          "libxrandr2",
          "libxkbcommon-dev",
          "libxfixes3",
          "libxcomposite1",
          "libxdamage1",
          "libpango-1.0-0",
          "libcairo2",
          "libcups2",
          "libatk-bridge2.0-0",
        ],
      }),
      prewarmRemotionChrome(),
    ],
  },
});
