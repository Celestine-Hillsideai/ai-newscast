import { NextResponse } from "next/server";
import { getNewscastDetail } from "@/lib/newscast-queries";
import { createSupabaseServerClient } from "@/lib/supabase-server";

/**
 * GET /api/newscasts/:id — the browser's only path to a newscast's detail
 * (result page). RLS-scoped to the caller's own session; a newscast that
 * exists but belongs to someone else reads back as not-found, same as one
 * that doesn't exist at all — RLS makes those indistinguishable, which is
 * the correct behavior here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const detail = await getNewscastDetail(supabase, id);

  if (!detail) {
    return NextResponse.json({ error: "Newscast not found." }, { status: 404 });
  }

  return NextResponse.json(detail);
}
