const CHANNELS = [
  {
    band: "CH. 1 — AUDIO",
    title: "Podcast",
    copy: "A two-minute narrated newscast, voiced by ElevenLabs, ready to listen to on the result page.",
  },
  {
    band: "CH. 2 — VIDEO",
    title: "Broadcast",
    copy: "Seven programmatic scenes — headline, developments, timeline, sources — rendered and synced to the narration.",
  },
] as const;

export function ChannelCards() {
  return (
    <section aria-label="Output formats" className="mx-auto max-w-3xl px-6 pb-24">
      <div className="grid gap-px overflow-hidden border border-wire bg-wire sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <div key={channel.band} className="bg-ink p-8">
            <div className="font-mono text-xs tracking-[0.2em] text-signal uppercase">
              {channel.band}
            </div>
            <h3 className="mt-3 font-display text-2xl font-bold tracking-tight text-paper uppercase">
              {channel.title}
            </h3>
            <p className="mt-2 font-body text-static">{channel.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
