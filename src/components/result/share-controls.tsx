"use client";

import { useState } from "react";

export function ShareControls({ videoUrl, audioUrl }: { videoUrl?: string; audioUrl?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — nothing to fall back to here.
    }
  }

  return (
    <div className="flex flex-wrap gap-4 font-mono text-xs tracking-[0.15em] uppercase">
      <button
        type="button"
        onClick={handleCopyLink}
        className="border border-wire px-4 py-2 text-static transition-colors hover:border-signal hover:text-signal focus-visible:border-signal focus-visible:text-signal focus-visible:outline-none"
      >
        {copied ? "Link copied" : "Copy link"}
      </button>
      {videoUrl && (
        <a
          href={videoUrl}
          download
          className="border border-wire px-4 py-2 text-static transition-colors hover:border-signal hover:text-signal"
        >
          Download video
        </a>
      )}
      {audioUrl && (
        <a
          href={audioUrl}
          download
          className="border border-wire px-4 py-2 text-static transition-colors hover:border-signal hover:text-signal"
        >
          Download audio
        </a>
      )}
    </div>
  );
}
