import AsyncStorage from "@react-native-async-storage/async-storage";
import { sanitizeTimelineTimestamp, uid, type LibraryItem, type ThemeMode } from "../shared/everyyou/domain";

const STORAGE_KEY_DEVICE_ID = "everyyou.mobile.deviceId";
const STORAGE_KEY_TOKEN = "everyyou.mobile.token";
const STORAGE_KEY_USER_NAME = "everyyou.mobile.userName";
const STORAGE_KEY_AVATAR_URI = "everyyou.mobile.avatarUri";
const STORAGE_KEY_THEME_MODE = "everyyou.mobile.themeMode";
const STORAGE_KEY_ONBOARDING_DONE = "everyyou.mobile.onboardingDone.v2";

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
    consumedAt?: number | null;
    timeOrigin?: LibraryItem["timeOrigin"] | null;
  }>;
};

type ProfileImportResponse = {
  items: Array<{
    type: LibraryItem["type"];
    source: LibraryItem["source"];
    title: string;
    authorOrArtist: string;
    consumedAt?: number | null;
    timeOrigin?: LibraryItem["timeOrigin"] | null;
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
  persona?: string;
  summary: string;
  highlights: string[];
  basis?: string[];
};

type DeepVibeCheckResponse = {
  access: "free" | "paywall";
  usesLeft: number;
  totalFreeUses: number;
  itemCount: number;
  summary: string;
  highlights: string[];
  basis?: string[];
  recommendations?: string[];
};

type TelegramLinkStatusResponse = {
  linked: boolean;
  telegramOwnerKey: string | null;
  code: string | null;
  expiresAt: string | null;
};

type TelegramLinkStartResponse = {
  code: string;
  expiresAt: string;
  instructions: string;
};

type ConnectedSource = {
  platform: "lastfm" | "letterboxd";
  profile: string;
  lastSyncedAt: string | null;
};

type ConnectedSourcesResponse = {
  sources: ConnectedSource[];
};

type SharedProfileResponse = {
  displayName: string | null;
  avatarUrl: string | null;
  themeMode: ThemeMode;
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
  const rawConsumedAt =
    typeof item.consumedAt === "number"
      ? item.consumedAt
      : item.consumed_at
        ? new Date(item.consumed_at).getTime()
        : undefined;
  const consumedAt = sanitizeTimelineTimestamp(rawConsumedAt);

  return {
    id: item.id,
    type: item.type,
    source: item.source,
    title: item.title,
    authorOrArtist: item.creator ?? "",
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    consumedAt,
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

export async function resetGuestSession() {
  await AsyncStorage.removeItem(STORAGE_KEY_TOKEN);
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

export async function getStoredOnboardingDone() {
  return (await AsyncStorage.getItem(STORAGE_KEY_ONBOARDING_DONE)) === "true";
}

export async function setStoredOnboardingDone(done: boolean) {
  if (done) {
    await AsyncStorage.setItem(STORAGE_KEY_ONBOARDING_DONE, "true");
    return;
  }
  await AsyncStorage.removeItem(STORAGE_KEY_ONBOARDING_DONE);
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

  const seenIds = new Set<string>();
  return data.items
    .filter((item) => {
      if (seenIds.has(item.id)) return false;
      seenIds.add(item.id);
      return true;
    })
    .map(mapServerItem);
}

export async function fetchSharedProfile(token: string) {
  return fetchJson<SharedProfileResponse>("/api/v2/profile", { method: "GET", headers: authHeaders(token) });
}

export async function saveSharedProfile(token: string, profile: SharedProfileResponse) {
  return fetchJson<SharedProfileResponse>("/api/v2/profile", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(profile),
  });
}

export async function uploadSharedProfileAvatar(token: string, uri: string) {
  const form = new FormData();
  form.append("file", { uri, name: "avatar.jpg", type: "image/jpeg" } as unknown as Blob);
  const response = await fetch(`${getApiBaseUrl()}/api/v2/profile/avatar`, { method: "POST", headers: authHeaders(token), body: form });
  const json = (await response.json().catch(() => null)) as { avatarUrl?: string; error?: string } | null;
  if (!response.ok || !json?.avatarUrl) throw new Error(json?.error ?? "не удалось загрузить аватар");
  return json.avatarUrl;
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

export async function runVibeCheck(token: string, input?: { from?: number; to?: number }) {
  return fetchJson<VibeCheckResponse>("/api/v2/analysis", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      from: input?.from ?? null,
      to: input?.to ?? null,
    }),
  });
}

export async function fetchCulturalMemoryConsent(token: string) {
  return fetchJson<{ enabled: boolean }>("/api/v2/cultural-memory-consent", { headers: authHeaders(token) });
}

export async function updateCulturalMemoryConsent(token: string, enabled: boolean) {
  return fetchJson<{ enabled: boolean }>("/api/v2/cultural-memory-consent", {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ enabled }),
  });
}

export async function fetchDeepVibeCheckAccess(token: string) {
  return fetchJson<Pick<DeepVibeCheckResponse, "access" | "usesLeft" | "totalFreeUses">>("/api/v2/deep-analysis", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function runDeepVibeCheck(token: string, input?: { from?: number; to?: number }) {
  return fetchJson<DeepVibeCheckResponse>("/api/v2/deep-analysis", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      from: input?.from ?? null,
      to: input?.to ?? null,
    }),
  });
}

export async function trackAnalyticsEvent(
  token: string,
  event: string,
  properties?: Record<string, unknown>
) {
  return fetchJson<{ ok: true }>("/api/v2/analytics", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ event, properties: properties ?? {} }),
  });
}

export async function fetchTelegramLinkStatus(token: string) {
  return fetchJson<TelegramLinkStatusResponse>("/api/v2/telegram-link/start", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function startTelegramLink(token: string) {
  return fetchJson<TelegramLinkStartResponse>("/api/v2/telegram-link/start", {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function fetchConnectedSources(token: string) {
  return fetchJson<ConnectedSourcesResponse>("/api/v2/connected-sources", {
    method: "GET",
    headers: authHeaders(token),
  });
}

export async function saveConnectedSource(
  token: string,
  input: { platform: "lastfm" | "letterboxd"; profile: string }
) {
  return fetchJson<{ source: ConnectedSource }>("/api/v2/connected-sources", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function disconnectConnectedSource(
  token: string,
  input: { platform: "lastfm" | "letterboxd"; deleteContent?: boolean }
) {
  return fetchJson<{ ok: true; disconnected: true; deletedItems: number }>("/api/v2/connected-sources", {
    method: "DELETE",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function disconnectSpotifyConnection(token: string, deleteContent = false) {
  return fetchJson<{ ok: true; disconnected: true; deletedItems: number }>(
    `/api/spotify/status?deleteContent=${deleteContent ? "1" : "0"}`,
    {
      method: "DELETE",
      headers: authHeaders(token),
    }
  );
}
