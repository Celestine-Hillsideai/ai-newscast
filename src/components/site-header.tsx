import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="mx-auto flex max-w-3xl items-baseline justify-between px-6 pt-8">
      <Link
        href="/"
        className="font-display text-lg font-extrabold tracking-tight text-paper uppercase"
      >
        AI NewsCast
      </Link>
      <Link
        href="/history"
        className="font-mono text-[0.65rem] tracking-[0.2em] text-static uppercase transition-colors hover:text-signal"
      >
        History
      </Link>
    </header>
  );
}
