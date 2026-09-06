import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { getEffectiveOwner } from "@/lib/ownerLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as { duelId?: unknown; winnerRunId?: unknown } | null;
  if (!body || typeof body.duelId !== "string" || typeof body.winnerRunId !== "string") {
    return NextResponse.json({ error: "duelId and winnerRunId are required" }, { status: 400 });
  }

  const owner = await getEffectiveOwner(auth);
  const { error } = await supabaseAdmin()
    .from("vibe_duels")
    .update({ winner_run_id: body.winnerRunId, decided_at: new Date().toISOString() })
    .eq("id", body.duelId)
    .eq("owner_key", owner.ownerKey)
    .is("winner_run_id", null)
    .or(`run_id_a.eq.${body.winnerRunId},run_id_b.eq.${body.winnerRunId}`);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
