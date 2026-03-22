import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { createSpotifyOAuthState } from "@/lib/spotifyOAuth";
import { getEffectiveOwner } from "@/lib/ownerLinks";

export const runtime = "nodejs";

const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-read-recently-played",
].join(" ");

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "SPOTIFY_CLIENT_ID or SPOTIFY_REDIRECT_URI missing" },
      { status: 500 }
    );
  }

  const state = createSpotifyOAuthState({
    ownerKey: owner.ownerKey,
    ownerKind: owner.ownerKind,
  });

  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("scope", SPOTIFY_SCOPES);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("show_dialog", "true");

  return NextResponse.json({ authUrl: authUrl.toString() });
}
