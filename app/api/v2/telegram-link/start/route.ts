import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { generateLinkCode } from "@/lib/ownerLinks";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  if (auth.authType !== "app") {
    return NextResponse.json({ error: "mobile app auth required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("owner_links")
    .select("telegram_owner_key, link_code, expires_at")
    .eq("app_owner_key", auth.ownerKey)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    linked: Boolean(data?.telegram_owner_key),
    telegramOwnerKey: data?.telegram_owner_key ?? null,
    code: data?.telegram_owner_key ? null : data?.link_code ?? null,
    expiresAt: data?.telegram_owner_key ? null : data?.expires_at ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  if (auth.authType !== "app") {
    return NextResponse.json({ error: "mobile app auth required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const code = generateLinkCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await sb.from("owner_links").upsert(
    {
      app_owner_key: auth.ownerKey,
      app_owner_kind: "app",
      link_code: code,
      expires_at: expiresAt,
      telegram_owner_key: null,
      telegram_owner_kind: null,
      claimed_at: null,
    },
    { onConflict: "app_owner_key" }
  );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    code,
    expiresAt,
    instructions: "открой mini app в telegram и введи этот код в блоке переноса в приложение",
  });
}
