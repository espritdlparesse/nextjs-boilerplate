import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";
import { safeTimelineIsoFromMs } from "@/lib/timeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getInitData(req: NextRequest) {
  return req.headers.get("x-telegram-init-data") ?? "";
}

function normalizeLegacySource(raw: unknown) {
  const source = String(raw ?? "").toLowerCase();
  if (source === "spotify" || source === "import_spotify") return "spotify";
  if (source === "yandex_music" || source === "import_yandex_music") return "import_yandex_music";
  if (source === "goodreads") return "goodreads";
  if (source === "letterboxd" || source === "import_letterboxd") return "letterboxd";
  return "manual";
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

    // режем пачку (на всякий)
    const slice = items.slice(0, 100);

    // ВАЖНО: здесь используем те же поля, что твой /api/items
    // (type, source, title, creator)
    const rows = slice.map((it: any) => ({
      tg_user_id: auth.tgUserId,
      type: it?.type,
      source: normalizeLegacySource(it?.source),
      title: it?.title,
      creator: it?.creator ?? null,
      consumed_at: safeTimelineIsoFromMs(it?.consumedAt),
      time_origin: typeof it?.timeOrigin === "string" ? it.timeOrigin : null,
    }));

    for (const r of rows) {
      if (!r.type || !r.source || !r.title) {
        return NextResponse.json(
          { error: "each item must include type, source, title" },
          { status: 400 }
        );
      }
    }

    const sb = supabaseAdmin();

    const { data, error } = await sb.from("items").insert(rows).select("*");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, inserted: data?.length ?? 0 });
  } catch (e: any) {
    // Если вдруг iOS роняет соединение из-за крэша в функции,
    // мы хотя бы гарантированно вернём JSON при любых ошибках.
    const msg = typeof e?.message === "string" ? e.message : "unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
