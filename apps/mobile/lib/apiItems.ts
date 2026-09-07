import type { ItemResponse } from "./apiCore";
import { authHeaders, fetchJson, getApiBaseUrl, mapServerItem, type ItemsResponse, type SharedProfileResponse } from "./apiCore";
import { type LibraryItem } from "../shared/everyyou/domain";

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
