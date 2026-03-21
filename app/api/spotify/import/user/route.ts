import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSpotifyAccessTokenForOwner } from "@/lib/spotifyConnection";

export const runtime = "nodejs";

type ImportMode = "liked" | "recently_played" | "playlist";

type SpotifyTrackShape = {
  name?: string;
  artists?: Array<{ name: string }>;
};

type SpotifyTrackPage = {
  items?: Array<{ track?: SpotifyTrackShape | null }>;
  next?: string | null;
};

type SpotifyRecentlyPlayedPage = {
  items?: Array<{ track?: SpotifyTrackShape | null }>;
};

function legacyNativeTgUserId(ownerKey: string) {
  let hash = 0;
  for (let i = 0; i < ownerKey.length; i += 1) {
    hash = (hash * 31 + ownerKey.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

function trackToItem(track: SpotifyTrackShape | null | undefined) {
  const title = track?.name?.trim().toLowerCase() ?? "";
  const authorOrArtist = (track?.artists ?? [])
    .map((artist) => artist.name.trim().toLowerCase())
    .filter(Boolean)
    .join(", ");

  if (!title || !authorOrArtist) return null;
  return {
    type: "music" as const,
    source: "import_spotify" as const,
    title,
    authorOrArtist,
  };
}

function dedupeItems<T extends { title: string; authorOrArtist: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}::${item.authorOrArtist}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchSpotify<T>(url: string, accessToken: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !json) throw new Error(`spotify request failed: ${response.status}`);
  return json;
}

async function loadSpotifyItems(
  accessToken: string,
  mode: ImportMode,
  playlistId?: string
) {
  const items: Array<{
    type: "music";
    source: "import_spotify";
    title: string;
    authorOrArtist: string;
  }> = [];

  if (mode === "liked") {
    let nextUrl: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";
    while (nextUrl) {
      const page: SpotifyTrackPage = await fetchSpotify<SpotifyTrackPage>(nextUrl, accessToken);
      for (const item of page.items ?? []) {
        const mapped = trackToItem(item.track);
        if (mapped) items.push(mapped);
      }
      nextUrl = page.next ?? null;
    }
    return dedupeItems(items);
  }

  if (mode === "recently_played") {
    const page: SpotifyRecentlyPlayedPage = await fetchSpotify<SpotifyRecentlyPlayedPage>(
      "https://api.spotify.com/v1/me/player/recently-played?limit=50",
      accessToken
    );
    for (const item of page.items ?? []) {
      const mapped = trackToItem(item.track);
      if (mapped) items.push(mapped);
    }
    return dedupeItems(items);
  }

  if (!playlistId) throw new Error("playlistId is required");

  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&market=US`;
  while (nextUrl) {
    const page: SpotifyTrackPage = await fetchSpotify<SpotifyTrackPage>(nextUrl, accessToken);
    for (const item of page.items ?? []) {
      const mapped = trackToItem(item.track);
      if (mapped) items.push(mapped);
    }
    nextUrl = page.next ?? null;
  }

  return dedupeItems(items);
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = (await req.json().catch(() => null)) as
    | { mode?: ImportMode; playlistId?: string }
    | null;

  const mode = body?.mode;
  if (!mode) return NextResponse.json({ error: "mode is required" }, { status: 400 });

  try {
    const accessToken = await getSpotifyAccessTokenForOwner(auth.ownerKey);
    const spotifyItems = await loadSpotifyItems(accessToken, mode, body?.playlistId);

    if (spotifyItems.length === 0) {
      return NextResponse.json({ importedCount: 0, skippedCount: 0, items: [] });
    }

    const sb = supabaseAdmin();
    const { data: existingItems, error: existingError } = await sb
      .from("items")
      .select("title, creator")
      .eq("owner_key", auth.ownerKey)
      .eq("source", "import_spotify");

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingKeys = new Set(
      (existingItems ?? []).map((item) => `${item.title}::${item.creator ?? ""}`)
    );

    const payload = spotifyItems
      .filter((item) => !existingKeys.has(`${item.title}::${item.authorOrArtist}`))
      .map((item) => ({
      owner_key: auth.ownerKey,
      owner_kind: auth.ownerKind,
      tg_user_id: auth.authType === "telegram" ? auth.legacyTgUserId : legacyNativeTgUserId(auth.ownerKey),
      type: item.type,
      source: item.source,
      title: item.title,
      creator: item.authorOrArtist,
    }));

    if (payload.length === 0) {
      return NextResponse.json({
        importedCount: 0,
        skippedCount: spotifyItems.length,
        items: [],
      });
    }

    const { data, error } = await sb.from("items").insert(payload).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      importedCount: payload.length,
      skippedCount: spotifyItems.length - payload.length,
      items: data ?? [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "spotify import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
