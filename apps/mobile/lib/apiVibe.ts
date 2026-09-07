import type { VibeCheckResponse, DeepVibeCheckResponse, TelegramLinkStatusResponse, TelegramLinkStartResponse, ConnectedSourcesResponse, ConnectedSource } from "./apiCore";
import { authHeaders, fetchJson } from "./apiCore";

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
