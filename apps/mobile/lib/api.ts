import AsyncStorage from "@react-native-async-storage/async-storage";
import { uid, type LibraryItem, type ThemeMode } from "../shared/everyyou/domain";

const STORAGE_KEY_DEVICE_ID = "everyyou.mobile.deviceId";
const STORAGE_KEY_TOKEN = "everyyou.mobile.token";
const STORAGE_KEY_USER_NAME = "everyyou.mobile.userName";
const STORAGE_KEY_AVATAR_URI = "everyyou.mobile.avatarUri";
const STORAGE_KEY_THEME_MODE = "everyyou.mobile.themeMode";

type GuestAuthResponse = {
  token: string;
  user: {
    id: string;
    kind: "guest";
    name: string | null;
  };
};

type ItemsResponse = {
  items: Array<{
    id: string;
    type: LibraryItem["type"];
    source: LibraryItem["source"];
    title: string;
    creator?: string | null;
    created_at?: string | null;
    createdAt?: number | null;
    consumed_at?: string | null;
    consumedAt?: number | null;
    time_origin?: LibraryItem["timeOrigin"] | null;
    timeOrigin?: LibraryItem["timeOrigin"] | null;
  }>;
};

type ItemResponse = {
  item: {
    id: string;
    type: LibraryItem["type"];
    source: LibraryItem["source"];
    title: string;
    creator?: string | null;
    created_at?: string | null;
    createdAt?: number | null;
    consumed_at?: string | null;
    consumedAt?: number | null;
    time_origin?: LibraryItem["timeOrigin"] | null;
    timeOrigin?: LibraryItem["timeOrigin"] | null;
  };
};

type ScreenshotAnalyzeResponse = {
  items: Array<{
    type: LibraryItem["type"];
    source: LibraryItem["source"];
    title: string;
    authorOrArtist: string;
    confidence?: number;
  }>;
};

type HealthResponse = {
  ok: boolean;
  env: Record<string, boolean>;
};

type SpotifyImportResponse = {
  items: Array<{
    type: LibraryItem["type"];
    source: LibraryItem["source"];
    title: string;
    authorOrArtist: string;
  }>;
};

type SpotifyOAuthStartResponse = {
  authUrl: string;
};

type SpotifyConnectionStatus = {
  connected: boolean;
  profile: {
    id: string;
    displayName: string | null;
    expiresAt: number;
  } | null;
};

type SpotifyPlaylistListResponse = {
  playlists: Array<{
    id: string;
    name: string;
    trackCount: number;
  }>;
};

type SpotifyUserImportResponse = {
  importedCount: number;
  skippedCount?: number;
  dateSummary?: string;
  dateCoverage?: {
    exact: number;
    imported: number;
    undated: number;
  };
};

type VibeCheckResponse = {
  itemCount: number;
  summary: string;
  highlights: string[];
};

function getApiBaseUrl() {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (!baseUrl) {
    throw new Error("EXPO_PUBLIC_API_BASE_URL missing");
  }
  return baseUrl.replace(/\/+$/, "");
}

async function getOrCreateDeviceId() {
  const current = await AsyncStorage.getItem(STORAGE_KEY_DEVICE_ID);
  if (current) return current;
  const next = uid();
  await AsyncStorage.setItem(STORAGE_KEY_DEVICE_ID, next);
  return next;
}

function mapServerItem(item: ItemsResponse["items"][number]): LibraryItem {
  const createdAt =
    typeof item.createdAt === "number"
      ? item.createdAt
      : item.created_at
        ? new Date(item.created_at).getTime()
        : undefined;
  const consumedAt =
    typeof item.consumedAt === "number"
      ? item.consumedAt
      : item.consumed_at
        ? new Date(item.consumed_at).getTime()
        : undefined;

  return {
    id: item.id,
    type: item.type,
    source: item.source,
    title: item.title,
    authorOrArtist: item.creator ?? "",
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    consumedAt: Number.isFinite(consumedAt) ? consumedAt : undefined,
    timeOrigin: item.timeOrigin ?? item.time_origin ?? undefined,
  };
}

async function fetchJson<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const json = (await response.json().catch(() => null)) as T | { error?: string } | null;
  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error" in json && typeof json.error === "string"
        ? json.error
        : `request failed with ${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

export async function ensureGuestSession(name = "ios friend") {
  const existingToken = await AsyncStorage.getItem(STORAGE_KEY_TOKEN);
  const existingName = (await AsyncStorage.getItem(STORAGE_KEY_USER_NAME)) ?? name;
  if (existingToken) {
    return { token: existingToken, name: existingName };
  }

  const deviceId = await getOrCreateDeviceId();
  const data = await fetchJson<GuestAuthResponse>("/api/auth/guest", {
    method: "POST",
    body: JSON.stringify({ deviceId, name: existingName }),
  });

  await AsyncStorage.setItem(STORAGE_KEY_TOKEN, data.token);
  await AsyncStorage.setItem(STORAGE_KEY_USER_NAME, data.user.name ?? existingName);

  return { token: data.token, name: data.user.name ?? existingName };
}

export async function getStoredGuestName(fallback = "ios friend") {
  return (await AsyncStorage.getItem(STORAGE_KEY_USER_NAME)) ?? fallback;
}

export async function setStoredGuestName(name: string) {
  await AsyncStorage.setItem(STORAGE_KEY_USER_NAME, name);
}

export async function getStoredAvatarUri() {
  return AsyncStorage.getItem(STORAGE_KEY_AVATAR_URI);
}

export async function setStoredAvatarUri(uri: string) {
  await AsyncStorage.setItem(STORAGE_KEY_AVATAR_URI, uri);
}

export async function clearStoredAvatarUri() {
  await AsyncStorage.removeItem(STORAGE_KEY_AVATAR_URI);
}

export async function getStoredThemeMode(): Promise<ThemeMode> {
  const value = await AsyncStorage.getItem(STORAGE_KEY_THEME_MODE);
  return value === "dark" ? "dark" : "light";
}

export async function setStoredThemeMode(mode: ThemeMode) {
  await AsyncStorage.setItem(STORAGE_KEY_THEME_MODE, mode);
}

export async function fetchBackendHealth() {
  return fetchJson<HealthResponse>("/api/health", {
    method: "GET",
  });
}

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchItems(token: string) {
  const data = await fetchJson<ItemsResponse>("/api/v2/items", {
    method: "GET",
    headers: authHeaders(token),
  });

  return data.items.map(mapServerItem);
}

export async function createItem(
  token: string,
  input: Pick<LibraryItem, "type" | "source" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin">
) {
  const data = await fetchJson<ItemResponse>("/api/v2/items", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      type: input.type,
      source: input.source,
      title: input.title,
      creator: input.authorOrArtist,
      consumedAt: input.consumedAt ?? null,
      timeOrigin: input.timeOrigin ?? null,
    }),
  });

  return mapServerItem(data.item);
}

export async function updateItem(
  token: string,
  input: Pick<LibraryItem, "id" | "type" | "source" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin">
) {
  const data = await fetchJson<ItemResponse>("/api/v2/items", {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      id: input.id,
      type: input.type,
      source: input.source,
      title: input.title,
      creator: input.authorOrArtist,
      consumedAt: input.consumedAt ?? null,
      timeOrigin: input.timeOrigin ?? null,
    }),
  });

  return mapServerItem(data.item);
}

export async function deleteItem(token: string, id: string) {
  await fetchJson<{ ok: true }>("/api/v2/items", {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify({ id }),
  });
}

export async function analyzeScreenshot(input: { imageBase64: string; mimeType: string }) {
  const data = await fetchJson<ScreenshotAnalyzeResponse>("/api/analyze-screenshot", {
    method: "POST",
    body: JSON.stringify(input),
  });

  return data.items;
}

export async function importFromSpotifyUrl(url: string) {
  const data = await fetchJson<SpotifyImportResponse>("/api/spotify/import", {
    method: "POST",
    body: JSON.stringify({ url }),
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

export async function runVibeCheck(token: string) {
  return fetchJson<VibeCheckResponse>("/api/v2/analysis", {
    method: "POST",
    headers: authHeaders(token),
  });
}
