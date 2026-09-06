import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { getEffectiveOwner } from "@/lib/ownerLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as {
    summary?: unknown;
    rating?: unknown;
    runId?: unknown;
  } | null;
  if (!body || typeof body.summary !== "string" || (body.rating !== "good" && body.rating !== "bad")) {
    return NextResponse.json({ error: "summary and rating are required" }, { status: 400 });
  }
  const owner = await getEffectiveOwner(auth);
  const { error } = await supabaseAdmin().from("vibe_feedback").insert({
    owner_key: owner.ownerKey,
    owner_kind: owner.ownerKind,
    summary: body.summary.trim().slice(0, 600),
    rating: body.rating,
    run_id: typeof body.runId === "string" ? body.runId : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
