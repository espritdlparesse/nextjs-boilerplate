import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

function getInitData(req: NextRequest) {
  return req.headers.get("x-telegram-init-data") ?? "";
}

function authTg(req: NextRequest) {
  const initData = getInitData(req);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return { ok: false as const, status: 500, message: "TELEGRAM_BOT_TOKEN missing" };
  }

  const verified = verifyTelegramInitData(initData, botToken);

  if (!verified.ok) {
    return { ok: false as const, status: 401, message: `tg auth failed: ${verified.reason}` };
  }

  const tgUserId = verified.user?.id;
  if (!tgUserId) {
    return { ok: false as const, status: 401, message: "tg user missing" };
  }

  return { ok: true as const, tgUserId: Number(tgUserId) };
}

export async function GET(req: NextRequest) {
  const auth = authTg(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("items")
    .select("*")
    .eq("tg_user_id", auth.tgUserId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const auth = authTg(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const { type, source, title, creator } = body;

  if (!type || !source || !title) {
    return NextResponse.json({ error: "type, source, title are required" }, { status: 400 });
  }

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("items")
    .insert({
      tg_user_id: auth.tgUserId,
      type,
      source,
      title,
      creator: creator ?? null,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

export async function PATCH(req: NextRequest) {
  const auth = authTg(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "bad json" }, { status: 400 });

  const { id, type, source, title, creator } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = supabaseAdmin();

  const { data, error } = await sb
    .from("items")
    .update({
      type,
      source,
      title,
      creator: creator ?? null,
    })
    .eq("id", id)
    .eq("tg_user_id", auth.tgUserId)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data });
}

export async function DELETE(req: NextRequest) {
  const auth = authTg(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = supabaseAdmin();

  const { error } = await sb
    .from("items")
    .delete()
    .eq("id", body.id)
    .eq("tg_user_id", auth.tgUserId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
