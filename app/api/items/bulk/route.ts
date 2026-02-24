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

export async function POST(req: NextRequest) {
  const auth = authTg(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await req.json().catch(() => null);
  const items = body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items[] is required" }, { status: 400 });
  }

  // нормализуем: ограничим размер пачки, чтобы не стрелять себе в ногу
  const slice = items.slice(0, 100);

  // ВАЖНО: ты в /api/items используешь поля: type, source, title, creator
  // Если у тебя в таблице поле называется иначе (author_or_artist) — скажи, я подгоню.
  const rows = slice.map((it: any) => ({
    tg_user_id: auth.tgUserId,
    type: it?.type,
    source: it?.source,
    title: it?.title,
    creator: it?.creator ?? null,
  }));

  // базовая валидация
  for (const r of rows) {
    if (!r.type || !r.source || !r.title) {
      return NextResponse.json({ error: "each item must include type, source, title" }, { status: 400 });
    }
  }

  const sb = supabaseAdmin();

  const { data, error } = await sb.from("items").insert(rows).select("*");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, inserted: data?.length ?? 0, items: data ?? [] });
}
