import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";
import { isAdminTgId } from "@/lib/admins";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified.ok || !isAdminTgId(verified.user?.id)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("items")
    .select("owner_key,tg_user_id");

  if (error || !data) return NextResponse.json([], { status: 200 });

  // Считаем айтемы по пользователям
  const counts: Record<string, number> = {};
  for (const row of data) {
    const id = row.owner_key || `tg:${String(row.tg_user_id)}`;
    counts[id] = (counts[id] || 0) + 1;
  }

  const { data: events } = await sb
    .from("app_events")
    .select("owner_key,created_at,properties")
    .eq("owner_kind", "telegram")
    .order("created_at", { ascending: false })
    .limit(5000);

  const latestIdentityByOwner = new Map<
    string,
    { username: string | null; firstName: string | null; lastName: string | null; lastSeen: string | null }
  >();

  for (const row of events ?? []) {
    if (!row.owner_key || latestIdentityByOwner.has(row.owner_key)) continue;
    const props = (row.properties ?? {}) as Record<string, unknown>;
    latestIdentityByOwner.set(row.owner_key, {
      username: typeof props.tgUsername === "string" ? props.tgUsername : null,
      firstName: typeof props.tgFirstName === "string" ? props.tgFirstName : null,
      lastName: typeof props.tgLastName === "string" ? props.tgLastName : null,
      lastSeen: row.created_at ?? null,
    });
  }

  const top = Object.entries(counts)
    .map(([owner_key, count]) => {
      const identity = latestIdentityByOwner.get(owner_key);
      return {
        owner_key,
        tg_user_id: owner_key.startsWith("tg:") ? owner_key.slice(3) : owner_key,
        count,
        username: identity?.username ?? null,
        first_name: identity?.firstName ?? null,
        last_name: identity?.lastName ?? null,
        last_seen: identity?.lastSeen ?? null,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json(top);
}
