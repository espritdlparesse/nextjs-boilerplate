import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type EventBody = {
  event?: string;
  properties?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as EventBody | null;
  const event = body?.event?.trim();
  if (!event) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from("app_events").insert({
    owner_key: auth.ownerKey,
    owner_kind: auth.ownerKind,
    event_name: event,
    properties: body?.properties ?? {},
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
