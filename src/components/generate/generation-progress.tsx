"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeRun } from "@trigger.dev/react-hooks";

const STAGE_LABELS: Record<string, string> = {
  queued: "Queued",
  researching: "Discovering — searching Nigerian outlets",
  extracting: "Extracting full article text",
  deduplicating: "Deduplicating repeated reports",
  verifying: "Verifying claims across sources",
  summarizing: "Synthesizing the briefing",
  scripting: "Writing the newscast script",
  generating_audio: "Narrating with ElevenLabs",
  generating_video: "Rendering the broadcast video",
  finalizing: "Finalizing",
  completed: "Complete",
  failed: "Failed",
};

const STAGE_ORDER = Object.keys(STAGE_LABELS).filter(
  (stage) => stage !== "completed" && stage !== "failed"
);

export function GenerationProgress({
  runId,
  publicAccessToken,
  newscastId,
}: {
  runId: string;
  publicAccessToken: string;
  newscastId: string;
}) {
  const router = useRouter();
  const { run, error } = useRealtimeRun(runId, { accessToken: publicAccessToken });

  const stage = (run?.metadata?.stage as string | undefined) ?? "queued";
  const isFailed = run?.status === "FAILED" || run?.status === "CRASHED" || stage === "failed";
  const isCompleted = run?.status === "COMPLETED" && !isFailed;

  useEffect(() => {
    if (isCompleted) {
      router.replace(`/result/${newscastId}`);
    }
  }, [isCompleted, newscastId, router]);

  const currentIndex = STAGE_ORDER.indexOf(stage);

  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <div className="mb-8 flex items-center gap-3 font-mono text-xs tracking-[0.2em] text-signal uppercase">
        <span className="relative flex h-2 w-2">
          {!isFailed && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${isFailed ? "bg-red-400" : "bg-signal"}`}
          />
        </span>
        {isFailed ? "Transmission failed" : "On air"}
      </div>

      <h1 className="mb-10 font-display text-4xl font-extrabold tracking-tight text-paper uppercase">
        {isFailed ? "Something went wrong" : "Producing your newscast"}
      </h1>

      {error && (
        <p className="mb-6 border border-red-400/40 bg-red-400/10 p-4 font-mono text-sm text-red-300">
          Lost the realtime connection: {error.message}
        </p>
      )}

      {isFailed ? (
        <p className="border border-red-400/40 bg-red-400/10 p-4 font-body text-red-300">
          {run?.error?.message ?? "The pipeline stopped before finishing. Please try again."}
        </p>
      ) : (
        <ol className="flex flex-col">
          {STAGE_ORDER.map((stageName, index) => {
            const isDone = currentIndex > index;
            const isActive = currentIndex === index;
            return (
              <li
                key={stageName}
                className={`flex items-center gap-4 border-b border-wire py-3 last:border-b-0 ${
                  isDone ? "text-static" : isActive ? "text-paper" : "text-static/50"
                }`}
              >
                <span
                  className={`font-mono text-xs ${isActive ? "text-signal" : ""}`}
                  aria-hidden
                >
                  {isDone ? "✓" : String(index + 1).padStart(2, "0")}
                </span>
                <span className="font-body">{STAGE_LABELS[stageName]}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
