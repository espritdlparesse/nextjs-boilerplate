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
  const { data, error } = await sb.rpc("admin_stats");

  if (error) {
    // Fallback — прямой SQL через execute
    const { data: rows } = await sb
      .from("items")
      .select("type, created_at");

    if (!rows) return NextResponse.json({ error: "db error" }, { status: 500 });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = {
      total_items: rows.length,
      music: rows.filter(r => r.type === "music").length,
      books: rows.filter(r => r.type === "book").length,
      movies: rows.filter(r => r.type === "movie").length,
      today: rows.filter(r => new Date(r.created_at) >= today).length,
    };

    // Получаем кол-во уникальных пользователей отдельно
    const { count } = await sb
      .from("items")
      .select("tg_user_id", { count: "exact", head: false });

    // Уникальные через distinct
    const { data: users } = await sb
      .from("items")
      .select("tg_user_id");

    const uniqueUsers = users
      ? new Set(users.map((u: any) => u.tg_user_id)).size
      : 0;

    return NextResponse.json({ ...stats, total_users: uniqueUsers });
  }

  return NextResponse.json(data);
}
