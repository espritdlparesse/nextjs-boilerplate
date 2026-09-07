import type { ScreenshotAnalyzeResponse, SpotifyImportResponse, ProfileImportResponse, SpotifyOAuthStartResponse, SpotifyConnectionStatus, SpotifyPlaylistListResponse, SpotifyUserImportResponse } from "./apiCore";
import { authHeaders, fetchJson } from "./apiCore";
import { sanitizeTimelineTimestamp, type LibraryItem } from "../shared/everyyou/domain";

export async function analyzeScreenshot(input: { imageBase64: string; mimeType: string }) {
  const data = await fetchJson<ScreenshotAnalyzeResponse>("/api/analyze-screenshot", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data.items;
}

export async function importFromSpotifyUrl(url: string) {
  const isYandexMusic = /(^|\.)music\.yandex\.(ru|com)(\/|$)/i.test(url.trim());
  const data = await fetchJson<SpotifyImportResponse>(isYandexMusic ? "/api/yandex-music/import" : "/api/spotify/import", {
    method: "POST",
    body: JSON.stringify({ url }),
  });

  return data.items;
}

export async function importFromLastfmProfile(username: string) {
  const data = await fetchJson<ProfileImportResponse>("/api/lastfm/import-profile", {
    method: "POST",
    body: JSON.stringify({ username }),
  });

  return data.items;
}

export async function importFromLetterboxdProfile(profile: string) {
  const data = await fetchJson<ProfileImportResponse>("/api/letterboxd/import-profile", {
    method: "POST",
    body: JSON.stringify({ profile }),
  });

  return data.items;
}

export async function getSpotifyOAuthUrl(token: string) {
  return fetchJson<SpotifyOAuthStartResponse>("/api/spotify/oauth/start", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function fetchSpotifyConnectionStatus(token: string) {
  return fetchJson<SpotifyConnectionStatus>("/api/spotify/status", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function fetchSpotifyPlaylists(token: string) {
  return fetchJson<SpotifyPlaylistListResponse>("/api/spotify/me/playlists", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function importFromSpotifyUser(
  token: string,
  input: { mode: "liked" | "recently_played" | "playlist"; playlistId?: string }
) {
  return fetchJson<SpotifyUserImportResponse>("/api/spotify/import/user", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}
