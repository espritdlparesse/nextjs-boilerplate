import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getEffectiveOwner } from "@/lib/ownerLinks";

export const runtime = "nodejs";

type EventBody = {
  event?: string;
  properties?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const body = (await req.json().catch(() => null)) as EventBody | null;
  const event = body?.event?.trim();
  if (!event) {
    return NextResponse.json({ error: "event is required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const identityProperties =
    auth.authType === "telegram"
      ? {
          tgUserId: auth.legacyTgUserId,
          tgUsername: auth.tgUsername ?? null,
          tgFirstName: auth.tgFirstName ?? null,
          tgLastName: auth.tgLastName ?? null,
        }
      : {
          appUserId: auth.appUserId,
          deviceId: auth.deviceId,
          appName: auth.name ?? null,
        };
  const { error } = await sb.from("app_events").insert({
    owner_key: owner.ownerKey,
    owner_kind: owner.ownerKind,
    event_name: event,
    properties: { ...identityProperties, ...(body?.properties ?? {}) },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
