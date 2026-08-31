import { NextRequest, NextResponse } from "next/server";
import { parseYandexPlaylistUrl } from "@/lib/yandexMusic";

export const runtime = "nodejs";

type ImportBody = { url?: string };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ImportBody | null;
  const playlist = body?.url ? parseYandexPlaylistUrl(body.url) : null;
  if (!playlist) {
    return NextResponse.json(
      { error: "вставь публичную ссылку на плейлист Яндекс.Музыки" },
      { status: 400 }
    );
  }

  const proxyUrl = process.env.YANDEX_MUSIC_PROXY_URL;
  const proxyToken = process.env.YANDEX_MUSIC_PROXY_TOKEN;
  if (!proxyUrl || !proxyToken) {
    return NextResponse.json(
      { error: "импорт Яндекс.Музыки еще настраивается" },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${proxyUrl.replace(/\/$/, "")}/v1/playlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Everyyou-Proxy-Token": proxyToken,
      },
      body: JSON.stringify(playlist),
      cache: "no-store",
    });
    const json = await response.json().catch(() => null);
    if (!response.ok || !json?.items) {
      throw new Error(json?.error ?? `proxy request failed: ${response.status}`);
    }
    return NextResponse.json({ items: json.items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "yandex music import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
