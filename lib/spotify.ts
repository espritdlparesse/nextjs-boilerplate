type SpotifyTokenResponse = {
  access_token: string;
};

type SpotifyTrackResponse = {
  name: string;
  artists?: Array<{ name: string }>;
};

type SpotifyAlbumTrackItem = {
  name: string;
  artists?: Array<{ name: string }>;
};

type SpotifyAlbumTracksResponse = {
  items?: SpotifyAlbumTrackItem[];
  next?: string | null;
};

type SpotifyPlaylistTrackItem = {
  track?: {
    name?: string;
    artists?: Array<{ name: string }>;
  } | null;
};

type SpotifyPlaylistTracksResponse = {
  items?: SpotifyPlaylistTrackItem[];
  next?: string | null;
};

function required(name: "SPOTIFY_CLIENT_ID" | "SPOTIFY_CLIENT_SECRET") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} missing`);
  return value;
}

function artistNames(artists?: Array<{ name: string }>) {
  return (artists ?? [])
    .map((artist) => artist.name.trim().toLowerCase())
    .filter(Boolean)
    .join(", ");
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

export function parseSpotifyUrl(input: string) {
  const trimmed = input.trim();
  const trackMatch = trimmed.match(/spotify\.com\/track\/([a-zA-Z0-9]+)|spotify:track:([a-zA-Z0-9]+)/);
  if (trackMatch) return { kind: "track" as const, id: trackMatch[1] || trackMatch[2] };

  const albumMatch = trimmed.match(/spotify\.com\/album\/([a-zA-Z0-9]+)|spotify:album:([a-zA-Z0-9]+)/);
  if (albumMatch) return { kind: "album" as const, id: albumMatch[1] || albumMatch[2] };

  const playlistMatch = trimmed.match(
    /spotify\.com\/playlist\/([a-zA-Z0-9]+)|spotify:playlist:([a-zA-Z0-9]+)/
  );
  if (playlistMatch) return { kind: "playlist" as const, id: playlistMatch[1] || playlistMatch[2] };

  return null;
}

async function getAccessToken() {
  const auth = Buffer.from(`${required("SPOTIFY_CLIENT_ID")}:${required("SPOTIFY_CLIENT_SECRET")}`).toString(
    "base64"
  );

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const json = (await response.json().catch(() => null)) as SpotifyTokenResponse | null;
  if (!response.ok || !json?.access_token) throw new Error("failed to get spotify access token");
  return json.access_token;
}

async function spotifyFetch<T>(url: string, token: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const json = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || !json) throw new Error(`spotify request failed: ${response.status}`);
  return json;
}

export async function importSpotifyMedia(parsed: { kind: "track" | "album" | "playlist"; id: string }) {
  const token = await getAccessToken();

  if (parsed.kind === "track") {
    const track = await spotifyFetch<SpotifyTrackResponse>(
      `https://api.spotify.com/v1/tracks/${parsed.id}?market=US`,
      token
    );

    return [
      {
        type: "music" as const,
        source: "import_spotify" as const,
        title: track.name.trim().toLowerCase(),
        authorOrArtist: artistNames(track.artists),
      },
    ];
  }

  const items: Array<{
    type: "music";
    source: "import_spotify";
    title: string;
    authorOrArtist: string;
  }> = [];

  let nextUrl: string | null = `https://api.spotify.com/v1/albums/${parsed.id}/tracks?limit=50&market=US`;
  if (parsed.kind === "playlist") {
    const playlistItems: Array<{
      type: "music";
      source: "import_spotify";
      title: string;
      authorOrArtist: string;
    }> = [];

    let playlistNextUrl: string | null = `https://api.spotify.com/v1/playlists/${parsed.id}/tracks?limit=100&market=US`;
    while (playlistNextUrl) {
      const page = await spotifyFetch<SpotifyPlaylistTracksResponse>(playlistNextUrl, token);
      for (const item of page.items ?? []) {
        const track = item.track;
        const title = track?.name?.trim().toLowerCase() ?? "";
        const authorOrArtist = artistNames(track?.artists);
        if (!title || !authorOrArtist) continue;
        playlistItems.push({
          type: "music",
          source: "import_spotify",
          title,
          authorOrArtist,
        });
      }
      playlistNextUrl = page.next ?? null;
    }

    return dedupeItems(playlistItems);
  }

  while (nextUrl) {
    const page = await spotifyFetch<SpotifyAlbumTracksResponse>(nextUrl, token);
    for (const track of page.items ?? []) {
      const title = track.name.trim().toLowerCase();
      const authorOrArtist = artistNames(track.artists);
      if (!title || !authorOrArtist) continue;
      items.push({
        type: "music",
        source: "import_spotify",
        title,
        authorOrArtist,
      });
    }
    nextUrl = page.next ?? null;
  }

  return dedupeItems(items);
}
