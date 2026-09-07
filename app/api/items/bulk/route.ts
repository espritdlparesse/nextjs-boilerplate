import { NextRequest, NextResponse } from "next/server";
import { normalizeLegacySource } from "@/lib/itemSources";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";
import { safeTimelineIsoFromMs } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * DEBUG ping:
 * Можно дернуть в браузере (не в Telegram) и увидеть, что роут живой.
 * В Telegram всё равно будет POST с auth.
 */
type ItemRow = ReturnType<typeof toItemRow>;

function toItemRow(item: any, tgUserId: number) {
  return {
    tg_user_id: tgUserId,
    type: item?.type,
    source: normalizeLegacySource(item?.source),
    title: item?.title,
    creator: item?.creator ?? null,
    consumed_at: safeTimelineIsoFromMs(item?.consumedAt),
    time_origin: typeof item?.timeOrigin === "string" ? item.timeOrigin : null,
  };
}

export async function GET() {
  return NextResponse.json({ ok: true, route: "/api/items/bulk" });
}

export async function POST(req: NextRequest) {
  try {
    const auth = authTg(req);
    if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

    const body = await req.json().catch(() => null);
    const items = body?.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items[] is required" }, { status: 400 });
    }

    const rows = items.slice(0, 100).map((item: any) => toItemRow(item, auth.tgUserId));
    if (rows.some((row: ItemRow) => !row.type || !row.source || !row.title)) {
      return NextResponse.json({ error: "each item must include type, source, title" }, { status: 400 });
    }

    const sb = supabaseAdmin();

    const { data, error } = await sb.from("items").insert(rows).select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
