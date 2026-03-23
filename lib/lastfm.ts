import { clampTimelineTimestampMs } from "@/lib/timeline";

type LastfmRecentTrack = {
  name?: string;
  artist?: { "#text"?: string };
  date?: { uts?: string };
};

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function importLastfmProfile(username: string, limit = 200) {
  const apiKey = process.env.LASTFM_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("LASTFM_API_KEY missing");
  }

  const normalizedUsername = username.trim();
  if (!normalizedUsername) {
    throw new Error("username is required");
  }

  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", normalizedUsername);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 200)));
  url.searchParams.set("extended", "0");

  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "everyyou/1.0",
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => null)) as
    | {
        recenttracks?: {
          track?: LastfmRecentTrack[] | LastfmRecentTrack;
          "@attr"?: { user?: string };
        };
        error?: number | string;
        message?: string;
      }
    | null;

  if (!response.ok || !json || json.error) {
    throw new Error(json?.message || "last.fm import failed");
  }

  const tracks = Array.isArray(json.recenttracks?.track)
    ? json.recenttracks?.track
    : json.recenttracks?.track
      ? [json.recenttracks.track]
      : [];

  const seen = new Set<string>();
  const items = tracks
    .map((track) => {
      const title = normalizeText(track.name).toLowerCase();
      const authorOrArtist = normalizeText(track.artist?.["#text"]).toLowerCase();
      const uts = normalizeText(track.date?.uts);
      const consumedAt = clampTimelineTimestampMs(/^\d+$/.test(uts) ? Number(uts) * 1000 : undefined);
      if (!title || !authorOrArtist) return null;
      const key = `${title}::${authorOrArtist}::${consumedAt ?? "undated"}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        type: "music" as const,
        source: "import_lastfm" as const,
        title,
        authorOrArtist,
        consumedAt,
        timeOrigin: consumedAt ? ("exact" as const) : undefined,
      };
    })
    .filter(Boolean);

  return items;
}
