"use client";

import { useEffect, useRef, useState } from "react";

const HEADLINE = "Raw noise in. Verified broadcast out.";

const WIRE_TOPICS = [
  "CBN interest rate decision",
  "Nigeria fuel subsidy removal",
  "ASUU strike update",
  "Naira exchange rate volatility",
  "JAMB result release",
];

export function HeroConsole() {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const [topic, setTopic] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = reduceMotion ? HEADLINE.length : 1;
    let index = 0;

    const interval = setInterval(() => {
      index += step;
      setTyped(HEADLINE.slice(0, index));
      if (index >= HEADLINE.length) {
        clearInterval(interval);
        setDone(true);
      }
    }, 28);

    return () => clearInterval(interval);
  }, []);

  function handleWireTopicClick(value: string) {
    setTopic(value);
    inputRef.current?.focus();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Wiring to POST /api/newscasts + the generation page lands in the next
    // increment of this phase — this form validates and captures the topic.
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-8 px-6 pt-20 pb-16 sm:pt-28">
      <div className="flex items-center gap-3 font-mono text-xs tracking-[0.2em] text-signal uppercase">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
        </span>
        Lagos &middot; Developing
      </div>

      <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-tight text-paper sm:text-7xl">
        {typed}
        <span
          aria-hidden
          className={`ml-1 inline-block h-[0.85em] w-[0.5ch] translate-y-1 bg-signal align-middle ${
            done ? "animate-pulse" : ""
          }`}
        />
      </h1>

      <p className="max-w-xl font-body text-lg text-static italic">
        Give it a Nigerian breaking-news topic. It searches the wires, extracts and verifies the
        reporting, then produces a podcast and video newscast &mdash; not a summary of one
        article, a synthesis of many.
      </p>

      <form onSubmit={handleSubmit} className="w-full">
        <label htmlFor="topic" className="mb-2 block font-mono text-xs tracking-[0.2em] text-static uppercase">
          Wire in a topic
        </label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            ref={inputRef}
            id="topic"
            name="topic"
            type="text"
            required
            minLength={3}
            maxLength={200}
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="e.g. CBN interest rate decision"
            className="flex-1 rounded-none border-2 border-wire bg-ink-raised px-4 py-3 font-mono text-base text-paper placeholder:text-static/60 focus:border-signal focus:ring-2 focus:ring-signal focus:outline-none"
          />
          <button
            type="submit"
            disabled={topic.trim().length < 3}
            className="border-2 border-cta bg-cta px-8 py-3 font-display text-lg font-bold tracking-wide text-ink uppercase transition-colors hover:bg-cta-dim hover:border-cta-dim disabled:cursor-not-allowed disabled:border-wire disabled:bg-wire disabled:text-static"
          >
            Generate
          </button>
        </div>
      </form>

      <div className="w-full overflow-hidden border-t border-b border-wire py-3">
        <div className="mb-2 font-mono text-[0.65rem] tracking-[0.2em] text-static uppercase">
          On the wire
        </div>
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {WIRE_TOPICS.map((wireTopic) => (
            <li key={wireTopic}>
              <button
                type="button"
                onClick={() => handleWireTopicClick(wireTopic)}
                className="font-mono text-sm text-static underline decoration-wire decoration-1 underline-offset-4 transition-colors hover:text-signal hover:decoration-signal focus-visible:text-signal focus-visible:outline-none"
              >
                {wireTopic}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
