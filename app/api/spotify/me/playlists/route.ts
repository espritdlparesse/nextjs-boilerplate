import { NextRequest, NextResponse } from "next/server";
import { fetchSpotify } from "@/lib/spotify";
import { resolveApiIdentity } from "@/lib/auth";
import { getSpotifyAccessTokenForOwner } from "@/lib/spotifyConnection";
import { getEffectiveOwner } from "@/lib/ownerLinks";

export const runtime = "nodejs";

type SpotifyPlaylistsPage = {
  items?: Array<{ id: string; name: string; tracks?: { total?: number } }>;
  next?: string | null;
};

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  try {
    const accessToken = await getSpotifyAccessTokenForOwner(owner.ownerKey);
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
