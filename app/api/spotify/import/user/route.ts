import { NextRequest, NextResponse } from "next/server";
import { fetchSpotify } from "@/lib/spotify";
import { resolveApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSpotifyAccessTokenForOwner } from "@/lib/spotifyConnection";
import { getEffectiveOwner, legacyNativeTgUserId } from "@/lib/ownerLinks";
import { safeTimelineIsoFromMs } from "@/lib/timeline";

export const runtime = "nodejs";

type ImportMode = "liked" | "recently_played" | "playlist";

type SpotifyTrackShape = {
  name?: string;
  artists?: Array<{ name: string }>;
};

type SpotifyTrackPage = {
  items?: Array<{ track?: SpotifyTrackShape | null; added_at?: string | null }>;
  next?: string | null;
};

type SpotifyRecentlyPlayedPage = {
  items?: Array<{ track?: SpotifyTrackShape | null; played_at?: string | null }>;
};

function trackToItem(
  track: SpotifyTrackShape | null | undefined,
  consumedAt?: string | null,
  timeOrigin: "exact" | "imported" = "exact"
) {
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
    consumedAt: consumedAt && Number.isFinite(Date.parse(consumedAt)) ? safeTimelineIsoFromMs(Date.parse(consumedAt)) : null,
    timeOrigin,
  };
}

function dedupeItems<T extends { title: string; authorOrArtist: string; consumedAt?: string | null; timeOrigin?: string | null }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.title}::${item.authorOrArtist}::${item.consumedAt ?? "undated"}::${item.timeOrigin ?? "none"}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildDateSummary<T extends { consumedAt?: string | null; timeOrigin?: string | null }>(items: T[]) {
  const exact = items.filter((item) => item.timeOrigin === "exact" && item.consumedAt).length;
  const imported = items.filter((item) => item.timeOrigin === "imported" && item.consumedAt).length;
  const undated = items.filter((item) => !item.consumedAt).length;
  const parts: string[] = [];
  if (exact > 0) parts.push(`точные даты: ${exact}`);
  if (imported > 0) parts.push(`из импорта: ${imported}`);
  if (undated > 0) parts.push(`без даты: ${undated}`);
  return parts.join(" · ");
}

function buildDateCoverage<T extends { consumedAt?: string | null; timeOrigin?: string | null }>(items: T[]) {
  return {
    exact: items.filter((item) => item.timeOrigin === "exact" && item.consumedAt).length,
    imported: items.filter((item) => item.timeOrigin === "imported" && item.consumedAt).length,
    undated: items.filter((item) => !item.consumedAt).length,
  };
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
    consumedAt: string | null;
    timeOrigin: "exact" | "imported";
  }> = [];

  if (mode === "liked") {
    let nextUrl: string | null = "https://api.spotify.com/v1/me/tracks?limit=50";
    while (nextUrl) {
      const page: SpotifyTrackPage = await fetchSpotify<SpotifyTrackPage>(nextUrl, accessToken);
      for (const item of page.items ?? []) {
        const mapped = trackToItem(item.track, item.added_at ?? null, "imported");
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
      const mapped = trackToItem(item.track, item.played_at ?? null, "exact");
      if (mapped) items.push(mapped);
    }
    return dedupeItems(items);
  }

  if (!playlistId) throw new Error("playlistId is required");

  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=100&market=US`;
  while (nextUrl) {
    const page: SpotifyTrackPage = await fetchSpotify<SpotifyTrackPage>(nextUrl, accessToken);
    for (const item of page.items ?? []) {
      const mapped = trackToItem(item.track, null, "imported");
      if (mapped) items.push(mapped);
    }
    nextUrl = page.next ?? null;
  }

  return dedupeItems(items);
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const owner = await getEffectiveOwner(auth);

  const body = (await req.json().catch(() => null)) as
    | { mode?: ImportMode; playlistId?: string }
    | null;

  const mode = body?.mode;
  if (!mode) return NextResponse.json({ error: "mode is required" }, { status: 400 });

  try {
    const accessToken = await getSpotifyAccessTokenForOwner(owner.ownerKey);
    const spotifyItems = await loadSpotifyItems(accessToken, mode, body?.playlistId);

    if (spotifyItems.length === 0) {
      return NextResponse.json({
        importedCount: 0,
        skippedCount: 0,
        items: [],
        dateSummary: "",
        dateCoverage: { exact: 0, imported: 0, undated: 0 },
      });
    }

    const sb = supabaseAdmin();
    const { data: existingItems, error: existingError } = await sb
      .from("items")
      .select("title, creator, consumed_at, time_origin")
      .eq("owner_key", owner.ownerKey)
      .eq("source", "import_spotify");

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 });
    }

    const existingKeys = new Set(
      (existingItems ?? []).map(
        (item) => `${item.title}::${item.creator ?? ""}::${item.consumed_at ?? "undated"}`
      )
    );

    const payload = spotifyItems
      .filter(
        (item) =>
          !existingKeys.has(
            `${item.title}::${item.authorOrArtist}::${item.consumedAt ?? "undated"}::${item.timeOrigin ?? "none"}`
          )
      )
      .map((item) => ({
      owner_key: owner.ownerKey,
      owner_kind: owner.ownerKind,
      tg_user_id:
        owner.ownerKind === "telegram" && owner.legacyTgUserId
          ? owner.legacyTgUserId
          : legacyNativeTgUserId(owner.ownerKey),
      type: item.type,
      source: item.source,
      title: item.title,
      creator: item.authorOrArtist,
      consumed_at: item.consumedAt,
      time_origin: item.timeOrigin,
    }));

    if (payload.length === 0) {
      return NextResponse.json({
        importedCount: 0,
        skippedCount: spotifyItems.length,
        items: [],
        dateSummary: buildDateSummary(spotifyItems),
        dateCoverage: buildDateCoverage(spotifyItems),
      });
    }

    const { data, error } = await sb.from("items").insert(payload).select("*");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      importedCount: payload.length,
      skippedCount: spotifyItems.length - payload.length,
      items: data ?? [],
      dateSummary: buildDateSummary(spotifyItems),
      dateCoverage: buildDateCoverage(spotifyItems),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "spotify import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
