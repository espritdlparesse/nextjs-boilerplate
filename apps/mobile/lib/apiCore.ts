import AsyncStorage from "@react-native-async-storage/async-storage";
import { sanitizeTimelineTimestamp, uid, type LibraryItem, type ThemeMode } from "../shared/everyyou/domain";

const STORAGE_KEY_DEVICE_ID = "everyyou.mobile.deviceId";
const STORAGE_KEY_TOKEN = "everyyou.mobile.token";
const STORAGE_KEY_USER_NAME = "everyyou.mobile.userName";
const STORAGE_KEY_AVATAR_URI = "everyyou.mobile.avatarUri";
const STORAGE_KEY_THEME_MODE = "everyyou.mobile.themeMode";
const STORAGE_KEY_ONBOARDING_DONE = "everyyou.mobile.onboardingDone.v2";

export type GuestAuthResponse = {
  token: string;
  user: {
    id: string;
    kind: "guest";
    name: string | null;
  };
};

export type ItemsResponse = {
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

export type ItemResponse = {
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

export type BulkItemsResponse = {
  ok: true;
  inserted: number;
  skipped: number;
};

export type ScreenshotAnalyzeResponse = {
  items: Array<{
    type: LibraryItem["type"];
    source: LibraryItem["source"];
    title: string;
    authorOrArtist: string;
    confidence?: number;
  }>;
};

export type HealthResponse = {
  ok: boolean;
  env: Record<string, boolean>;
};

export type SpotifyImportResponse = {
  items: Array<{
    type: LibraryItem["type"];
    source: LibraryItem["source"];
    title: string;
    authorOrArtist: string;
    consumedAt?: number | null;
    timeOrigin?: LibraryItem["timeOrigin"] | null;
  }>;
};

export type ProfileImportedItem = {
  type: LibraryItem["type"];
  source: LibraryItem["source"];
  title: string;
  authorOrArtist: string;
  consumedAt?: number | null;
  timeOrigin?: LibraryItem["timeOrigin"] | null;
};

export type ProfileImportResponse = { items: ProfileImportedItem[] };

export type SpotifyOAuthStartResponse = {
  authUrl: string;
};

export type SpotifyConnectionStatus = {
  connected: boolean;
  profile: {
    id: string;
    displayName: string | null;
    expiresAt: number;
  } | null;
};

export type SpotifyPlaylistListResponse = {
  playlists: Array<{
    id: string;
    name: string;
    trackCount: number;
  }>;
};

export type SpotifyUserImportResponse = {
  importedCount: number;
  skippedCount?: number;
  dateSummary?: string;
  dateCoverage?: {
    exact: number;
    imported: number;
    undated: number;
  };
};

export type VibeCheckResponse = {
  itemCount: number;
  persona?: string;
  summary: string;
  highlights: string[];
  basis?: string[];
};

export type DeepVibeCheckResponse = {
  access: "free" | "paywall";
  usesLeft: number;
  totalFreeUses: number;
  itemCount: number;
  summary: string;
  highlights: string[];
  basis?: string[];
  recommendations?: string[];
};

export type TelegramLinkStatusResponse = {
  linked: boolean;
  telegramOwnerKey: string | null;
  code: string | null;
  expiresAt: string | null;
};

export type TelegramLinkStartResponse = {
  code: string;
  expiresAt: string;
  instructions: string;
};

export type ConnectedSource = {
  platform: "lastfm" | "letterboxd";
  profile: string;
  lastSyncedAt: string | null;
};

export type ConnectedSourcesResponse = {
  sources: ConnectedSource[];
};

export type SharedProfileResponse = {
  displayName: string | null;
  avatarUrl: string | null;
  themeMode: ThemeMode;
};

export function getApiBaseUrl() {
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

export function mapServerItem(item: ItemsResponse["items"][number]): LibraryItem {
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

export async function fetchJson<T>(path: string, init?: RequestInit) {
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

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}
