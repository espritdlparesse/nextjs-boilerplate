import { supabaseAdmin } from "@/lib/supabaseAdmin";

type SpotifyConnectionRow = {
  owner_key: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

function required(name: "SPOTIFY_CLIENT_ID" | "SPOTIFY_CLIENT_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing`);
  return value;
}

async function getConnection(ownerKey: string) {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("spotify_connections")
    .select("owner_key, access_token, refresh_token, expires_at")
    .eq("owner_key", ownerKey)
    .single();

  if (error || !data) throw new Error("spotify account not connected");
  return data as SpotifyConnectionRow;
}

export async function getSpotifyAccessTokenForOwner(ownerKey: string) {
  const connection = await getConnection(ownerKey);
  if (connection.expires_at > Date.now() + 60_000) {
    return connection.access_token;
  }

  const clientId = required("SPOTIFY_CLIENT_ID");
  const clientSecret = required("SPOTIFY_CLIENT_SECRET");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: connection.refresh_token,
    }).toString(),
  });

  const json = (await response.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; refresh_token?: string }
    | null;

  if (!response.ok || !json?.access_token || !json?.expires_in) {
    throw new Error("failed to refresh spotify token");
  }

  const sb = supabaseAdmin();
  await sb
    .from("spotify_connections")
    .update({
      access_token: json.access_token,
      refresh_token: json.refresh_token ?? connection.refresh_token,
      expires_at: Date.now() + json.expires_in * 1000,
    })
    .eq("owner_key", connection.owner_key);

  return json.access_token;
}
