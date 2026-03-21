import { NextRequest, NextResponse } from "next/server";
import { importSpotifyMedia, parseSpotifyUrl } from "@/lib/spotify";

export const runtime = "nodejs";

type SpotifyImportBody = {
  url?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as SpotifyImportBody | null;
  if (!body?.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const parsed = parseSpotifyUrl(body.url);
  if (!parsed) {
    return NextResponse.json(
      { error: "supported spotify links: track, album, and playlist" },
      { status: 400 }
    );
  }

  try {
    const items = await importSpotifyMedia(parsed);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "spotify import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
