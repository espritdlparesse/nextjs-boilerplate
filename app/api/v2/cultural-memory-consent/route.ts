import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { data, error } = await supabaseAdmin()
    .from("cultural_memory_consents")
    .select("enabled, updated_at")
    .eq("owner_key", auth.ownerKey)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enabled: data?.enabled ?? false, updatedAt: data?.updated_at ?? null });
}

export async function PUT(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
  if (typeof body?.enabled !== "boolean") return NextResponse.json({ error: "enabled must be boolean" }, { status: 400 });

  const { data, error } = await supabaseAdmin()
    .from("cultural_memory_consents")
    .upsert(
      { owner_key: auth.ownerKey, owner_kind: auth.ownerKind, enabled: body.enabled, updated_at: new Date().toISOString() },
      { onConflict: "owner_key" }
    )
    .select("enabled, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ enabled: data.enabled, updatedAt: data.updated_at });
}
