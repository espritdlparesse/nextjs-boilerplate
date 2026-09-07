import { clampTimelineTimestampMs } from "@/lib/timeline";

type LastfmRecentTrack = {
  name?: string;
  artist?: { "#text"?: string };
  date?: { uts?: string };
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

type LastfmResponse = {
  recenttracks?: { track?: LastfmRecentTrack[] | LastfmRecentTrack };
  error?: number | string;
  message?: string;
} | null;

function recentTracksUrl(apiKey: string, username: string, limit: number) {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", username);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 200)));
  url.searchParams.set("extended", "0");
  return url.toString();
}

async function fetchRecentTracks(apiKey: string, username: string, limit: number) {
  const response = await fetch(recentTracksUrl(apiKey, username, limit), {
    headers: { "User-Agent": "everyyou/1.0" },
    cache: "no-store",
  });
  const json = (await response.json().catch(() => null)) as LastfmResponse;
  if (!response.ok || !json || json.error) {
    throw new Error(json?.message || "last.fm import failed");
  }

  const track = json.recenttracks?.track;
  if (Array.isArray(track)) return track;
  return track ? [track] : [];
}

function toMusicItem(track: LastfmRecentTrack) {
  const title = normalizeText(track.name).toLowerCase();
  const authorOrArtist = normalizeText(track.artist?.["#text"]).toLowerCase();
  if (!title || !authorOrArtist) return null;
  const uts = normalizeText(track.date?.uts);
  const consumedAt = clampTimelineTimestampMs(/^\d+$/.test(uts) ? Number(uts) * 1000 : undefined);
  return {
    type: "music" as const,
    source: "import_lastfm" as const,
    title,
    authorOrArtist,
    consumedAt,
    timeOrigin: consumedAt ? ("exact" as const) : undefined,
  };
}

export async function importLastfmProfile(username: string, limit = 200) {
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!apiKey) throw new Error("LASTFM_API_KEY missing");

  const normalizedUsername = username.trim();
  if (!normalizedUsername) throw new Error("username is required");

  const tracks = await fetchRecentTracks(apiKey, normalizedUsername, limit);
  const seen = new Set<string>();
  const items = [];
  for (const track of tracks) {
    const item = toMusicItem(track);
    if (!item) continue;
    const key = `${item.title}::${item.authorOrArtist}::${item.consumedAt ?? "undated"}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}
