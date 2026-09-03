import { notFound, redirect } from "next/navigation";
import { getNewscastDetail } from "@/lib/newscast-queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ShareControls } from "@/components/result/share-controls";
import { SiteHeader } from "@/components/site-header";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-xs tracking-[0.2em] text-static uppercase">{children}</h2>
  );
}

export default async function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const detail = await getNewscastDetail(supabase, id);

  if (!detail) notFound();
  if (detail.status === "failed") {
    return (
      <main>
        <SiteHeader />
        <div className="mx-auto max-w-2xl px-6 py-20">
          <h1 className="mb-4 font-display text-3xl font-extrabold text-paper uppercase">
            This newscast failed
          </h1>
          <p className="border border-red-400/40 bg-red-400/10 p-4 font-body text-red-300">
            {detail.errorMessage ?? "Something went wrong before this newscast could finish."}
          </p>
        </div>
      </main>
    );
  }
  if (detail.status !== "completed") redirect(`/generate/${id}`);

  const dateline = new Date(detail.completedAt ?? detail.createdAt).toLocaleString("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <main>
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="mb-8 font-mono text-xs tracking-[0.2em] text-signal uppercase">
        {dateline} &middot; Verified
      </div>

      <h1 className="mb-3 font-display text-4xl leading-tight font-extrabold tracking-tight text-paper uppercase sm:text-5xl">
        {detail.headline}
      </h1>
      {detail.dek && <p className="mb-10 font-body text-lg text-static italic">{detail.dek}</p>}

      {detail.video && (
        <video
          controls
          className="mb-4 w-full border border-wire bg-ink-raised"
          src={detail.video.url}
        />
      )}
      {detail.audio && (
        <audio controls className="mb-8 w-full" src={detail.audio.url}>
          Your browser does not support the audio element.
        </audio>
      )}

      <div className="mb-10">
        <ShareControls videoUrl={detail.video?.url} audioUrl={detail.audio?.url} />
      </div>

      {detail.summary && (
        <section className="mb-10">
          <SectionLabel>Summary</SectionLabel>
          <p className="font-body text-paper">{detail.summary}</p>
        </section>
      )}

      {detail.keyDevelopments.length > 0 && (
        <section className="mb-10">
          <SectionLabel>Key developments</SectionLabel>
          <ul className="flex flex-col gap-2">
            {detail.keyDevelopments.map((item) => (
              <li key={item} className="flex gap-3 font-body text-paper">
                <span aria-hidden className="text-signal-dim">
                  &bull;
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.whyItMatters && (
        <section className="mb-10">
          <SectionLabel>Why it matters</SectionLabel>
          <p className="font-body text-paper">{detail.whyItMatters}</p>
        </section>
      )}

      {(detail.whatWeKnow.length > 0 || detail.whatWeDoNotKnow.length > 0) && (
        <section className="mb-10 grid gap-8 sm:grid-cols-2">
          {detail.whatWeKnow.length > 0 && (
            <div>
              <SectionLabel>What we know</SectionLabel>
              <ul className="flex flex-col gap-2">
                {detail.whatWeKnow.map((item) => (
                  <li key={item} className="font-body text-sm text-paper">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {detail.whatWeDoNotKnow.length > 0 && (
            <div>
              <SectionLabel>What remains unclear</SectionLabel>
              <ul className="flex flex-col gap-2">
                {detail.whatWeDoNotKnow.map((item) => (
                  <li key={item} className="font-body text-sm text-static">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {detail.timeline.length > 0 && (
        <section className="mb-10">
          <SectionLabel>Timeline</SectionLabel>
          <ol className="flex flex-col">
            {detail.timeline.map((entry, index) => (
              <li
                key={`${entry.label}-${index}`}
                className="border-b border-wire py-3 last:border-b-0"
              >
                <div className="font-mono text-xs text-signal uppercase">{entry.label}</div>
                <div className="font-body text-paper">{entry.description}</div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {detail.sources.length > 0 && (
        <section className="mb-10">
          <SectionLabel>Sources</SectionLabel>
          <ul className="flex flex-col gap-3">
            {detail.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-paper underline decoration-wire underline-offset-4 transition-colors hover:text-signal hover:decoration-signal"
                >
                  {source.title}
                </a>
                {source.sourceName && (
                  <span className="ml-2 font-mono text-xs text-static uppercase">
                    {source.sourceName}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {detail.confidenceScore !== null && (
        <p className="font-mono text-xs text-static">
          Confidence score: {Math.round(detail.confidenceScore * 100)}%
        </p>
      )}
      </div>
    </main>
  );
}
