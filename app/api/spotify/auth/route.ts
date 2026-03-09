import { NextRequest, NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

// GET /api/spotify/auth — редиректит пользователя на авторизацию Spotify
export async function GET(req: NextRequest) {
  const initData = req.nextUrl.searchParams.get("initData") ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified.ok) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tgUserId = verified.user?.id;
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://everyyou-mvp.vercel.app"}/api/spotify/callback`;

  const scope = "user-read-recently-played";
  const state = Buffer.from(JSON.stringify({ tgUserId, initData })).toString("base64url");

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state,
  });

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params}`);
}
