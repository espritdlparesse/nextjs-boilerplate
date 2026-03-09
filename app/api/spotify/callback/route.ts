import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

// GET /api/spotify/callback — Spotify редиректит сюда после авторизации
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code || !state) {
    return new NextResponse(`<html><body><script>window.close();</script><p>Ошибка авторизации: ${error}</p></body></html>`, {
      headers: { "Content-Type": "text/html" },
    });
  }

  let tgUserId: number;
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString());
    tgUserId = Number(parsed.tgUserId);
  } catch {
    return new NextResponse("Invalid state", { status: 400 });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://everyyou-mvp.vercel.app"}/api/spotify/callback`;

  // Обмениваем code на токены
  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokens = await tokenRes.json();
  if (!tokens.access_token) {
    return new NextResponse("Failed to get tokens", { status: 500 });
  }

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
  const sb = supabaseAdmin();

  await sb.from("spotify_tokens").upsert({
    tg_user_id: tgUserId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt.toISOString(),
    updated_at: new Date().toISOString(),
  });

  // Сразу запускаем первичный импорт
  await syncSpotify(tgUserId, tokens.access_token, sb);

  // Закрываем окно и возвращаем в приложение
  return new NextResponse(
    `<html><body><script>
      if (window.opener) { window.opener.postMessage('spotify_connected', '*'); window.close(); }
      else { window.location.href = 'https://t.me/every_you_bot'; }
    </script><p>Spotify подключён! Можно закрыть это окно.</p></body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}

async function syncSpotify(tgUserId: number, accessToken: string, sb: any) {
  const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=50", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return;

  const data = await res.json();
  const tracks = data.items ?? [];

  for (const item of tracks) {
    const track = item.track;
    const playedAt = item.played_at;
    const title = track.name;
    const creator = track.artists?.map((a: any) => a.name).join(", ") ?? null;

    await sb.from("items").upsert({
      tg_user_id: tgUserId,
      type: "music",
      source: "spotify",
      title,
      creator,
      played_at: playedAt,
    }, { onConflict: "tg_user_id,source,title,COALESCE(creator, '')" });
  }
}
