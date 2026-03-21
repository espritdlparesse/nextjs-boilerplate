import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    env: {
      supabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      telegramBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
      everyyouAppAuthSecret: Boolean(process.env.EVERYYOU_APP_AUTH_SECRET),
      openaiApiKey: Boolean(process.env.OPENAI_API_KEY),
      spotifyClientId: Boolean(process.env.SPOTIFY_CLIENT_ID),
      spotifyClientSecret: Boolean(process.env.SPOTIFY_CLIENT_SECRET),
    },
  });
}
