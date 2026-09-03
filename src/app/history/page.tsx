import Link from "next/link";
import { listNewscasts } from "@/lib/newscast-queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { STATUS_LABELS } from "@/lib/newscast-status-labels";

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const newscasts = await listNewscasts(supabase);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10 flex items-baseline justify-between">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-paper uppercase">
          History
        </h1>
        <Link
          href="/"
          className="font-mono text-xs tracking-[0.2em] text-static uppercase transition-colors hover:text-signal"
        >
          New newscast
        </Link>
      </header>

      {newscasts.length === 0 ? (
        <p className="font-body text-static">
          No newscasts yet.{" "}
          <Link href="/" className="text-signal underline underline-offset-4">
            Wire in a topic
          </Link>{" "}
          to produce your first one.
        </p>
      ) : (
        <ol className="flex flex-col">
          {newscasts.map((newscast) => {
            const href =
              newscast.status === "completed"
                ? `/result/${newscast.id}`
                : newscast.status === "failed"
                  ? `/result/${newscast.id}`
                  : `/generate/${newscast.id}`;
            const dateline = new Date(newscast.createdAt).toLocaleString("en-NG", {
              dateStyle: "medium",
              timeStyle: "short",
            });

            return (
              <li key={newscast.id} className="border-b border-wire py-5 last:border-b-0">
                <Link href={href} className="group flex flex-col gap-1">
                  <div className="flex items-center gap-3 font-mono text-xs tracking-[0.15em] uppercase">
                    <span
                      className={
                        newscast.status === "failed"
                          ? "text-red-400"
                          : newscast.status === "completed"
                            ? "text-verified"
                            : "text-signal"
                      }
                    >
                      {STATUS_LABELS[newscast.status]}
                    </span>
                    <span className="text-static">{dateline}</span>
                  </div>
                  <div className="font-display text-xl font-bold text-paper uppercase group-hover:text-signal">
                    {newscast.headline ?? newscast.topic}
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
