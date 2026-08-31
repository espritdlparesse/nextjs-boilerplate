import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { getEffectiveOwner } from "@/lib/ownerLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ProfileBody = {
  displayName?: unknown;
  avatarUrl?: unknown;
  themeMode?: unknown;
};

function asOptionalText(value: unknown, limit: number) {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value.trim().slice(0, limit) || null;
}

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);
  const { data, error } = await supabaseAdmin()
    .from("profile_settings")
    .select("display_name, avatar_url, theme_mode, updated_at")
    .eq("owner_key", owner.ownerKey)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    displayName: data?.display_name ?? null,
    avatarUrl: data?.avatar_url ?? null,
    themeMode: data?.theme_mode === "dark" ? "dark" : "light",
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const body = (await req.json().catch(() => null)) as ProfileBody | null;
  if (!body) return NextResponse.json({ error: "invalid profile" }, { status: 400 });
  const displayName = asOptionalText(body.displayName, 60);
  const avatarUrl = asOptionalText(body.avatarUrl, 1000);
  const themeMode = body.themeMode === "dark" ? "dark" : body.themeMode === "light" ? "light" : undefined;
  if (displayName === undefined || avatarUrl === undefined) return NextResponse.json({ error: "invalid profile fields" }, { status: 400 });
  const owner = await getEffectiveOwner(auth);
  const { data, error } = await supabaseAdmin()
    .from("profile_settings")
    .upsert({
      owner_key: owner.ownerKey,
      owner_kind: owner.ownerKind,
      display_name: displayName,
      avatar_url: avatarUrl,
      theme_mode: themeMode ?? "light",
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_key" })
    .select("display_name, avatar_url, theme_mode, updated_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ displayName: data.display_name, avatarUrl: data.avatar_url, themeMode: data.theme_mode, updatedAt: data.updated_at });
}
