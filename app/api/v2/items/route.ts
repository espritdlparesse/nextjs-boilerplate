import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";
import { getEffectiveOwner, type EffectiveOwner } from "@/lib/ownerLinks";

export const runtime = "nodejs";

type ItemBody = {
  id?: string;
  type?: string;
  source?: string;
  title?: string;
  creator?: string | null;
  consumedAt?: number | null;
  timeOrigin?: "exact" | "imported" | "estimated" | null;
};

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function legacyNativeTgUserId(ownerKey: string) {
  let hash = 0;
  for (let i = 0; i < ownerKey.length; i += 1) {
    hash = (hash * 31 + ownerKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

async function updateLegacyTelegramItem(
  req: NextRequest,
  body: ItemBody,
  mode: "update" | "delete"
) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  if (auth.authType !== "telegram") {
    return NextResponse.json({ error: "legacy fallback is telegram-only" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  if (mode === "delete") {
    const { error } = await sb
      .from("items")
      .delete()
      .eq("id", body.id)
      .eq("tg_user_id", auth.legacyTgUserId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, legacy: true });
  }

  const { data, error } = await sb
    .from("items")
    .update({
      type: body.type,
      source: body.source,
      title: body.title,
      creator: body.creator ?? null,
      owner_key: auth.ownerKey,
      owner_kind: auth.ownerKind,
      consumed_at:
        typeof body.consumedAt === "number" && Number.isFinite(body.consumedAt)
          ? new Date(body.consumedAt).toISOString()
          : null,
      time_origin: body.timeOrigin ?? null,
    })
    .eq("id", body.id)
    .eq("tg_user_id", auth.legacyTgUserId)
    .select("*")
    .single();

  if (error && (isMissingConsumedAtColumn(error) || isMissingTimeOriginColumn(error))) {
    const retry = await sb
      .from("items")
      .update({
        type: body.type,
        source: body.source,
        title: body.title,
        creator: body.creator ?? null,
        owner_key: auth.ownerKey,
        owner_kind: auth.ownerKind,
      })
      .eq("id", body.id)
      .eq("tg_user_id", auth.legacyTgUserId)
      .select("*")
      .single();

    if (retry.error) return NextResponse.json({ error: retry.error.message }, { status: 500 });
    return NextResponse.json({ item: retry.data, legacy: true });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data, legacy: true });
}

function isMissingOwnerColumns(error: { message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("owner_key") || message.includes("owner_kind");
}

function isMissingConsumedAtColumn(error: { message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("consumed_at");
}

function isMissingTimeOriginColumn(error: { message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("time_origin");
}

async function selectItemsForOwner(
  sb: ReturnType<typeof supabaseAdmin>,
  owner: EffectiveOwner
) {
  const baseQuery =
    owner.ownerKind === "telegram" && owner.legacyTgUserId
      ? sb
          .from("items")
          .select("*")
          .or(`owner_key.eq.${owner.ownerKey},tg_user_id.eq.${owner.legacyTgUserId}`)
      : sb.from("items").select("*").eq("owner_key", owner.ownerKey);

  let response = await baseQuery.order("consumed_at", { ascending: false, nullsFirst: false });
  if (response.error && isMissingConsumedAtColumn(response.error)) {
    response = await baseQuery.order("created_at", { ascending: false });
  }

  return response;
}

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const sb = supabaseAdmin();
  const { data, error } = await selectItemsForOwner(sb, owner);

  if (error && isMissingOwnerColumns(error)) {
    return NextResponse.json({
      items: [],
      warning: "supabase migration missing: owner_key / owner_kind",
    });
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const body = (await req.json().catch(() => null)) as ItemBody | null;
  if (!body) return badRequest("bad json");

  const { type, source, title, creator } = body;
  if (!type || !source || !title) {
    return badRequest("type, source, title are required");
  }

  const sb = supabaseAdmin();
  if (source === "import_spotify") {
    const { data: existing } = await sb
      .from("items")
      .select("*")
      .eq("owner_key", owner.ownerKey)
      .eq("source", "import_spotify")
      .eq("title", title)
      .eq("creator", creator ?? null)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ item: existing, deduped: true });
    }
  }

  const insertPayload: Record<string, string | number | null> = {
    owner_key: owner.ownerKey,
    owner_kind: owner.ownerKind,
    type,
    source,
    title,
    creator: creator ?? null,
    consumed_at:
      typeof body.consumedAt === "number" && Number.isFinite(body.consumedAt)
        ? new Date(body.consumedAt).toISOString()
        : null,
    time_origin: body.timeOrigin ?? null,
  };

  if (owner.ownerKind === "telegram" && owner.legacyTgUserId) {
    insertPayload.tg_user_id = owner.legacyTgUserId;
  } else {
    // Temporary compatibility shim for legacy schemas where tg_user_id is still NOT NULL.
    insertPayload.tg_user_id = legacyNativeTgUserId(owner.ownerKey);
  }

  let { data, error } = await sb.from("items").insert(insertPayload).select("*").single();

  if (error && (isMissingConsumedAtColumn(error) || isMissingTimeOriginColumn(error))) {
    const { consumed_at, time_origin, ...legacyPayload } = insertPayload;
    const retry = await sb.from("items").insert(legacyPayload).select("*").single();
    data = retry.data;
    error = retry.error;
  }

  if (error && isMissingOwnerColumns(error)) {
    return NextResponse.json(
      {
        error: "supabase migration missing: owner_key / owner_kind",
      },
      { status: 500 }
    );
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const body = (await req.json().catch(() => null)) as ItemBody | null;
  if (!body) return badRequest("bad json");
  if (!body.id) return badRequest("id is required");

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("items")
    .update({
      type: body.type,
      source: body.source,
      title: body.title,
      creator: body.creator ?? null,
      consumed_at:
        typeof body.consumedAt === "number" && Number.isFinite(body.consumedAt)
          ? new Date(body.consumedAt).toISOString()
          : null,
      time_origin: body.timeOrigin ?? null,
    })
    .eq("id", body.id)
    .eq("owner_key", owner.ownerKey)
    .select("*")
    .single();

  if (error && (isMissingConsumedAtColumn(error) || isMissingTimeOriginColumn(error))) {
    const retry = await sb
      .from("items")
      .update({
        type: body.type,
        source: body.source,
        title: body.title,
        creator: body.creator ?? null,
      })
      .eq("id", body.id)
      .eq("owner_key", owner.ownerKey)
      .select("*")
      .single();

    if (!retry.error) return NextResponse.json({ item: retry.data });
    if (auth.authType === "telegram" && retry.error.code === "PGRST116") {
      return updateLegacyTelegramItem(req, body, "update");
    }
    return NextResponse.json({ error: retry.error.message }, { status: 500 });
  }

  if (!error) return NextResponse.json({ item: data });

  if (isMissingOwnerColumns(error)) {
    return NextResponse.json(
      {
        error: "supabase migration missing: owner_key / owner_kind",
      },
      { status: 500 }
    );
  }

  if (auth.authType === "telegram" && error.code === "PGRST116") {
    return updateLegacyTelegramItem(req, body, "update");
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}

export async function DELETE(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const body = (await req.json().catch(() => null)) as ItemBody | null;
  if (!body?.id) return badRequest("id is required");

  const sb = supabaseAdmin();
  const { error } = await sb.from("items").delete().eq("id", body.id).eq("owner_key", owner.ownerKey);

  if (!error) return NextResponse.json({ ok: true });

  if (isMissingOwnerColumns(error)) {
    return NextResponse.json(
      {
        error: "supabase migration missing: owner_key / owner_kind",
      },
      { status: 500 }
    );
  }

  if (auth.authType === "telegram" && error.code === "PGRST116") {
    return updateLegacyTelegramItem(req, body, "delete");
  }

  return NextResponse.json({ error: error.message }, { status: 500 });
}
