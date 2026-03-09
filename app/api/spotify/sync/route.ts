import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

function getTgUserOrThrow(req: NextRequest) {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified.ok) throw new Error("unauthorized");
  if (!verified.user?.id) throw new Error("no user");
  return Number(verified.user.id);
}

async function getValidAccessToken(tgUserId: number, sb: any): Promise<string | null> {
  const { data: tokenRow } = await sb
    .from("spotify_tokens")
    .select("*")
    .eq("tg_user_id", tgUserId)
    .single();

  if (!tokenRow) return null;

  // Токен ещё действителен?
  if (new Date(tokenRow.expires_at) > new Date(Date.now() + 60_000)) {
    return tokenRow.access_token;
  }

  // Обновляем токен
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenRow.refresh_token,
    }),
  });

  const tokens = await res.json();
  if (!tokens.access_token) return null;

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  await sb.from("spotify_tokens").update({
    access_token: tokens.access_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
    ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
  }).eq("tg_user_id", tgUserId);

  return tokens.access_token;
}

// GET — проверить подключён ли Spotify
export async function GET(req: NextRequest) {
  try {
    const tgUserId = getTgUserOrThrow(req);
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("spotify_tokens")
      .select("tg_user_id")
      .eq("tg_user_id", tgUserId)
      .single();
    return NextResponse.json({ connected: !!data });
  } catch {
    return NextResponse.json({ connected: false });
  }
}

// POST — запустить синхронизацию вручную
export async function POST(req: NextRequest) {
  try {
    const tgUserId = getTgUserOrThrow(req);
    const sb = supabaseAdmin();

    const accessToken = await getValidAccessToken(tgUserId, sb);
    if (!accessToken) {
      return NextResponse.json({ error: "not_connected" }, { status: 403 });
    }

    const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return NextResponse.json({ error: "spotify_error" }, { status: 500 });

    const data = await res.json();
    const tracks = data.items ?? [];
    let added = 0;

    for (const item of tracks) {
      const track = item.track;
      const title = track.name;
      const creator = track.artists?.map((a: any) => a.name).join(", ") ?? null;
      const playedAt = item.played_at;

      const { error } = await sb.from("items").upsert({
        tg_user_id: tgUserId,
        type: "music",
        source: "spotify",
        title,
        creator,
        played_at: playedAt,
      }, { onConflict: "tg_user_id,source,title,COALESCE(creator, '')" });

      if (!error) added++;
    }

    return NextResponse.json({ ok: true, synced: added });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
