import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveApiIdentity } from "@/lib/auth";

export const runtime = "nodejs";

type ItemBody = {
  id?: string;
  type?: string;
  source?: string;
  title?: string;
  creator?: string | null;
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
    })
    .eq("id", body.id)
    .eq("tg_user_id", auth.legacyTgUserId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data, legacy: true });
}

function isMissingOwnerColumns(error: { message?: string | null } | null) {
  const message = error?.message?.toLowerCase() ?? "";
  return message.includes("owner_key") || message.includes("owner_kind");
}

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const sb = supabaseAdmin();

  if (auth.authType === "telegram") {
    const { data, error } = await sb
      .from("items")
      .select("*")
      .or(`owner_key.eq.${auth.ownerKey},tg_user_id.eq.${auth.legacyTgUserId}`)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data ?? [] });
  }

  const { data, error } = await sb
    .from("items")
    .select("*")
    .eq("owner_key", auth.ownerKey)
    .order("created_at", { ascending: false });

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

  const body = (await req.json().catch(() => null)) as ItemBody | null;
  if (!body) return badRequest("bad json");

  const { type, source, title, creator } = body;
  if (!type || !source || !title) {
    return badRequest("type, source, title are required");
  }

  const sb = supabaseAdmin();
  const insertPayload: Record<string, string | number | null> = {
    owner_key: auth.ownerKey,
    owner_kind: auth.ownerKind,
    type,
    source,
    title,
    creator: creator ?? null,
  };

  if (auth.authType === "telegram") {
    insertPayload.tg_user_id = auth.legacyTgUserId;
  } else {
    // Temporary compatibility shim for legacy schemas where tg_user_id is still NOT NULL.
    insertPayload.tg_user_id = legacyNativeTgUserId(auth.ownerKey);
  }

  const { data, error } = await sb.from("items").insert(insertPayload).select("*").single();

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
    })
    .eq("id", body.id)
    .eq("owner_key", auth.ownerKey)
    .select("*")
    .single();

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

  const body = (await req.json().catch(() => null)) as ItemBody | null;
  if (!body?.id) return badRequest("id is required");

  const sb = supabaseAdmin();
  const { error } = await sb.from("items").delete().eq("id", body.id).eq("owner_key", auth.ownerKey);

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
