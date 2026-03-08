import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

const ADMIN_TG_ID = 394657396;

export async function GET(req: NextRequest) {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified.ok || Number(verified.user?.id) !== ADMIN_TG_ID) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .select("tg_user_id");

  if (error || !data) return NextResponse.json([], { status: 200 });

  // Считаем айтемы по пользователям
  const counts: Record<string, number> = {};
  for (const row of data) {
    const id = String(row.tg_user_id);
    counts[id] = (counts[id] || 0) + 1;
  }

  const top = Object.entries(counts)
    .map(([tg_user_id, count]) => ({ tg_user_id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json(top);
}
