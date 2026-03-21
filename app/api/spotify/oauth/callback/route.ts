import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { verifySpotifyOAuthState } from "@/lib/spotifyOAuth";

export const runtime = "nodejs";

function required(name: "SPOTIFY_CLIENT_ID" | "SPOTIFY_CLIENT_SECRET" | "SPOTIFY_REDIRECT_URI") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing`);
  return value;
}

async function fetchSpotifyProfile(accessToken: string) {
  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const json = (await response.json().catch(() => null)) as
    | { id?: string; display_name?: string | null }
    | null;

  if (!response.ok || !json?.id) throw new Error("failed to fetch spotify profile");
  return json;
}

function html(message: string) {
  return new NextResponse(
    `<!doctype html><html><body style="font-family:system-ui;padding:24px"><h1>${message}</h1><p>Можно вернуться в приложение EveryYou.</p></body></html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    }
  );
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const error = req.nextUrl.searchParams.get("error");

  if (error) return html(`Spotify login failed: ${error}`);
  if (!code || !state) return html("Spotify callback is missing code or state");

  try {
    const verified = verifySpotifyOAuthState(state);
    const redirectUri = required("SPOTIFY_REDIRECT_URI");
    const clientId = required("SPOTIFY_CLIENT_ID");
    const clientSecret = required("SPOTIFY_CLIENT_SECRET");

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    const json = (await response.json().catch(() => null)) as
      | {
          access_token?: string;
          refresh_token?: string;
          expires_in?: number;
          scope?: string;
        }
      | null;

    if (!response.ok || !json?.access_token || !json?.refresh_token || !json?.expires_in) {
      return html("Failed to exchange Spotify auth code");
    }

    const profile = await fetchSpotifyProfile(json.access_token);
    const sb = supabaseAdmin();

    const { error: upsertError } = await sb.from("spotify_connections").upsert(
      {
        owner_key: verified.ownerKey,
        owner_kind: verified.ownerKind,
        spotify_user_id: profile.id,
        spotify_display_name: profile.display_name ?? null,
        access_token: json.access_token,
        refresh_token: json.refresh_token,
        expires_at: Date.now() + json.expires_in * 1000,
        scope: json.scope ?? null,
      },
      {
        onConflict: "owner_key",
      }
    );

    if (upsertError) return html(`Failed to save Spotify connection: ${upsertError.message}`);
    return html("Spotify connected successfully");
  } catch (caughtError) {
    const message = caughtError instanceof Error ? caughtError.message : "Spotify callback failed";
    return html(message);
  }
}
