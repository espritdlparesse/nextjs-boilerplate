import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { getSpotifyAccessTokenForOwner } from "@/lib/spotifyConnection";

export const runtime = "nodejs";

type SpotifyPlaylistsPage = {
  items?: Array<{ id: string; name: string; tracks?: { total?: number } }>;
  next?: string | null;
};

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

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  try {
    const accessToken = await getSpotifyAccessTokenForOwner(auth.ownerKey);
    const playlists: Array<{ id: string; name: string; tracks?: { total?: number } }> = [];

    let nextUrl: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
    while (nextUrl) {
      const page: SpotifyPlaylistsPage = await fetchSpotify<SpotifyPlaylistsPage>(
        nextUrl,
        accessToken
      );

      playlists.push(...(page.items ?? []));
      nextUrl = page.next ?? null;
    }

    return NextResponse.json({
      playlists: playlists.map((playlist) => ({
        id: playlist.id,
        name: playlist.name,
        trackCount: playlist.tracks?.total ?? 0,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to fetch playlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
