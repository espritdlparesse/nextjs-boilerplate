import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";
import { buildOwnerReadFilter, getOwnerScope, type EffectiveOwner, type OwnerScope } from "@/lib/ownerLinks";

export const runtime = "nodejs";

function getInitData(req: NextRequest) {
  return req.headers.get("x-telegram-init-data") ?? "";
}

function normalizeLegacySource(raw: unknown) {
  const source = String(raw ?? "").toLowerCase();
  if (source === "spotify" || source === "import_spotify") return "spotify";
  if (source === "goodreads") return "goodreads";
  if (source === "letterboxd" || source === "import_letterboxd") return "letterboxd";
  return "manual";
}

async function resolveTelegramOwner(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) {
    return { ok: false as const, status: auth.status, message: auth.message };
  }

  const scope = await getOwnerScope(auth);
  const tgUsername = auth.authType === "telegram" ? null : null;
  return { ok: true as const, owner: scope.primaryOwner, scope, tgUsername };
}

async function selectItemsForOwner(
  sb: ReturnType<typeof supabaseAdmin>,
  scope: OwnerScope
) {
  const pageSize = 1000;
  const rows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await sb
      .from("items")
      .select("*, custom_categories!custom_category_id(name, emoji)")
      .or(buildOwnerReadFilter(scope))
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) {
      return { data: null, error };
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  return { data: rows, error: null };
}

export async function GET(req: NextRequest) {
  const auth = await resolveTelegramOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const sb = supabaseAdmin();
  const { data, error } = await selectItemsForOwner(sb, auth.scope);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Разворачиваем join
  const items = (data ?? []).map((it: any) => ({
    ...it,
    custom_category_name: it.custom_categories?.name ?? null,
    custom_category_emoji: it.custom_categories?.emoji ?? null,
    custom_categories: undefined,
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const auth = await resolveTelegramOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const { type, source, title, creator, custom_category_id } = body;
  if (!type || !source || !title) {
    return NextResponse.json({ error: "type, source, title are required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .insert({
      tg_user_id: auth.owner.legacyTgUserId ?? null,
      tg_username: auth.tgUsername,
      owner_key: auth.owner.ownerKey,
      owner_kind: auth.owner.ownerKind,
      type,
      source: normalizeLegacySource(source),
      title,
      creator: creator ?? null,
      custom_category_id: custom_category_id ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const auth = await resolveTelegramOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const { id, type, source, title, creator } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .update({ type, source: normalizeLegacySource(source), title, creator: creator ?? null })
    .eq("id", id)
    .or(buildOwnerReadFilter(auth.scope))
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await resolveTelegramOwner(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("items")
    .delete()
    .eq("id", body.id)
    .or(buildOwnerReadFilter(auth.scope));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
