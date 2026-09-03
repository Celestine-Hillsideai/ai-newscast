import { NextResponse } from "next/server";
import { auth, tasks } from "@trigger.dev/sdk/v3";
import { topicInputSchema } from "@/lib/schemas/newscast";
import { listNewscasts } from "@/lib/newscast-queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/newscasts — the history page's only path to this data (browser
 * never queries Supabase directly, per workflows/architecture-communication.md
 * section 4). RLS-scoped to the caller's own session.
 */
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const newscasts = await listNewscasts(supabase);
  return NextResponse.json({ newscasts });
}

/**
 * POST /api/newscasts — the only place a newscast run gets started. Runs
 * server-side on Vercel: validates the topic, writes the initial row under
 * the caller's own RLS-scoped session, then triggers the backend pipeline on
 * Trigger.dev using TRIGGER_SECRET_KEY (server-only, never in the client
 * bundle). See workflows/architecture-communication.md section 1.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const topicResult = topicInputSchema.safeParse((body as { topic?: unknown })?.topic);
  if (!topicResult.success) {
    return NextResponse.json(
      { error: "topic must be a string between 3 and 200 characters." },
      { status: 400 }
    );
  }
  const topic = topicResult.data;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No session — reload and try again." }, { status: 401 });
  }

  const { data: newscast, error: insertError } = await supabase
    .from("newscasts")
    .insert({ user_id: user.id, topic, status: "queued" })
    .select("id")
    .single();

  if (insertError || !newscast) {
    return NextResponse.json({ error: "Could not create newscast." }, { status: 500 });
  }

  const handle = await tasks.trigger("generate-newscast", {
    newscastId: newscast.id,
    topic,
  });

  // Not persisted here: newscasts has no UPDATE policy for `authenticated`
  // (RLS — only the service-role key writes status/content). The
  // generate-newscast task records its own trigger_run_id at startup instead.

  const publicAccessToken = await auth.createPublicToken({
    scopes: { read: { runs: [handle.id] } },
    expirationTime: "1h",
  });

  return NextResponse.json({
    newscastId: newscast.id,
    runId: handle.id,
    publicAccessToken,
  });
}
