import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = {
  code?: string;
};

function getInitData(req: NextRequest) {
  return req.headers.get("x-telegram-init-data") ?? "";
}

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN missing" }, { status: 500 });

  const verified = verifyTelegramInitData(getInitData(req), botToken);
  if (!verified.ok) return NextResponse.json({ error: `tg auth failed: ${verified.reason}` }, { status: 401 });

  const tgUserId = verified.user?.id ? Number(verified.user.id) : null;
  if (!tgUserId) return NextResponse.json({ error: "tg user missing" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const code = body?.code?.trim().toUpperCase();
  if (!code) return NextResponse.json({ error: "code is required" }, { status: 400 });

  const sb = supabaseAdmin();
  const { data: linkRow, error: linkError } = await sb
    .from("owner_links")
    .select("*")
    .eq("link_code", code)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  if (!linkRow) return NextResponse.json({ error: "код не найден или уже устарел" }, { status: 404 });

  const telegramOwnerKey = `tg:${tgUserId}`;

  const { data: existingTelegramLink, error: existingTelegramLinkError } = await sb
    .from("owner_links")
    .select("app_owner_key, telegram_owner_key")
    .eq("telegram_owner_key", telegramOwnerKey)
    .neq("app_owner_key", linkRow.app_owner_key)
    .maybeSingle();

  if (existingTelegramLinkError) {
    return NextResponse.json({ error: existingTelegramLinkError.message }, { status: 500 });
  }

  const migrations = await Promise.allSettled([
    sb.from("items").update({ owner_key: telegramOwnerKey, owner_kind: "telegram", tg_user_id: tgUserId }).eq("owner_key", linkRow.app_owner_key),
    sb.from("app_events").update({ owner_key: telegramOwnerKey, owner_kind: "telegram" }).eq("owner_key", linkRow.app_owner_key),
    sb.from("analysis_usage_v2").update({ owner_key: telegramOwnerKey, owner_kind: "telegram" }).eq("owner_key", linkRow.app_owner_key),
    sb.from("spotify_connections").update({ owner_key: telegramOwnerKey, owner_kind: "telegram" }).eq("owner_key", linkRow.app_owner_key),
  ]);

  for (const result of migrations) {
    if (result.status === "fulfilled" && result.value.error) {
      const message = result.value.error.message.toLowerCase();
      if (!message.includes("relation") && !message.includes("does not exist")) {
        return NextResponse.json({ error: result.value.error.message }, { status: 500 });
      }
    }
  }

  if (existingTelegramLink?.app_owner_key) {
    const { error: deleteConflictingLinkError } = await sb
      .from("owner_links")
      .delete()
      .eq("app_owner_key", existingTelegramLink.app_owner_key);

    if (deleteConflictingLinkError) {
      return NextResponse.json({ error: deleteConflictingLinkError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await sb
    .from("owner_links")
    .update({
      telegram_owner_key: telegramOwnerKey,
      telegram_owner_kind: "telegram",
      claimed_at: new Date().toISOString(),
      link_code: null,
    })
    .eq("app_owner_key", linkRow.app_owner_key);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    telegramOwnerKey,
    message: "telegram и мобильное приложение теперь связаны",
  });
}
