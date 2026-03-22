import { NextRequest, NextResponse } from "next/server";
import { importLastfmProfile } from "@/lib/lastfm";

export const runtime = "nodejs";

type Body = {
  username?: string;
  limit?: number;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const items = await importLastfmProfile(body.username, body.limit ?? 200);
    return NextResponse.json({ items });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "last.fm import failed";
    const message =
      rawMessage === "LASTFM_API_KEY missing"
        ? "last.fm по username пока не настроен на сервере. пока что используй csv"
        : rawMessage;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
