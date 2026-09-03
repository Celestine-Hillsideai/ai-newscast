const RUNDOWN = [
  {
    number: "01",
    label: "Discover & extract",
    copy: "Searches Nigerian news outlets for the topic, then pulls the full text of every relevant report.",
  },
  {
    number: "02",
    label: "Deduplicate & verify",
    copy: "Collapses repeated reports of the same story and cross-checks claims across sources before anything is trusted.",
  },
  {
    number: "03",
    label: "Synthesize",
    copy: "Turns verified reporting into a structured briefing: what happened, why it matters, what's still unclear.",
  },
  {
    number: "04",
    label: "Narrate",
    copy: "Writes and voices a two-minute spoken newscast script with ElevenLabs — no fact enters the script that isn't in the briefing.",
  },
  {
    number: "05",
    label: "Visualize & publish",
    copy: "Renders a seven-scene broadcast video synced to the narration, then publishes both to the result page.",
  },
] as const;

export function PipelineRundown() {
  return (
    <section aria-labelledby="rundown-heading" className="mx-auto max-w-3xl px-6 py-16">
      <h2
        id="rundown-heading"
        className="mb-2 font-mono text-xs tracking-[0.2em] text-static uppercase"
      >
        Today&rsquo;s rundown
      </h2>
      <p className="mb-10 max-w-xl font-body text-static">
        Every newscast runs the same five-segment production line, in the same order, every time.
      </p>
      <ol className="flex flex-col">
        {RUNDOWN.map((item, index) => (
          <li
            key={item.number}
            className={`flex gap-6 py-6 ${
              index !== RUNDOWN.length - 1 ? "border-b border-wire" : ""
            }`}
          >
            <span
              aria-hidden
              className="font-display text-3xl font-extrabold text-signal-dim tabular-nums"
            >
              {item.number}
            </span>
            <div>
              <h3 className="font-display text-xl font-bold tracking-tight text-paper uppercase">
                {item.label}
              </h3>
              <p className="mt-1 max-w-lg font-body text-static">{item.copy}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
