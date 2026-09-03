import { HeroConsole } from "@/components/home/hero-console";
import { PipelineRundown } from "@/components/home/pipeline-rundown";
import { ChannelCards } from "@/components/home/channel-cards";

export default function HomePage() {
  return (
    <main>
      <header className="mx-auto flex max-w-3xl items-baseline justify-between px-6 pt-8">
        <span className="font-display text-lg font-extrabold tracking-tight text-paper uppercase">
          AI NewsCast
        </span>
        <span className="font-mono text-[0.65rem] tracking-[0.2em] text-static uppercase">
          Est. Lagos
        </span>
      </header>

      <HeroConsole />
      <PipelineRundown />
      <ChannelCards />

      <footer className="border-t border-wire px-6 py-8">
        <p className="mx-auto max-w-3xl font-mono text-xs text-static">
          AI NewsCast synthesizes verified Nigerian reporting &mdash; it does not generate facts.
        </p>
      </footer>
    </main>
  );
}
