import { notFound, redirect } from "next/navigation";
import { auth } from "@trigger.dev/sdk/v3";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { GenerationProgress } from "@/components/generate/generation-progress";

export default async function GeneratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: newscast } = await supabase
    .from("newscasts")
    .select("status, trigger_run_id")
    .eq("id", id)
    .maybeSingle();

  if (!newscast) notFound();
  if (newscast.status === "completed") redirect(`/result/${id}`);
  if (!newscast.trigger_run_id) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <p className="font-mono text-static">Starting the run — refresh in a moment.</p>
      </main>
    );
  }

  const publicAccessToken = await auth.createPublicToken({
    scopes: { read: { runs: [newscast.trigger_run_id] } },
    expirationTime: "1h",
  });

  return (
    <main>
      <GenerationProgress
        runId={newscast.trigger_run_id}
        publicAccessToken={publicAccessToken}
        newscastId={id}
      />
    </main>
  );
}
