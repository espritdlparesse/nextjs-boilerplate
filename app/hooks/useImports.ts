import type { Tab, VibeDuel, VibeDuelVariant, ItemType, ItemSource, ImportedItem, DbItem, ImportPlatform, ImportService } from "@/app/types";
import { apiFetch, getTgInitData, safeJson } from "@/app/apiFetch";
import { useEffect, useMemo, useRef, useState } from "react";
import { parseImportedFile } from "@/apps/mobile/lib/fileImports";

function toImportedItems(raw: unknown, fallbackSource: string): ImportedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    type: item.type,
    source: item.source ?? fallbackSource,
    title: item.title,
    creator: item.authorOrArtist ?? "",
    consumedAt: typeof item.consumedAt === "number" ? item.consumedAt : undefined,
    timeOrigin: item.timeOrigin ?? undefined,
  }));
}

function toYandexTracks(raw: unknown): ImportedItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => ({
      type: "music" as const,
      source: "import_yandex_music" as const,
      title: String(item.title ?? ""),
      creator: String(item.authorOrArtist ?? "") || undefined,
    }))
    .filter((item) => item.title && item.creator);
}

const PROFILE_IMPORTS = {
  lastfm: {
    endpoint: "/api/lastfm/import-profile",
    bodyKey: "username",
    emptyInput: "введи username last.fm",
    lookingUp: "смотрим профиль last.fm...",
    fetching: "тянем recent tracks...",
    failed: "не удалось импортировать профиль last.fm",
    found: (count: number) => `готово: нашли ${count} трек(ов) в last.fm`,
  },
  letterboxd: {
    endpoint: "/api/letterboxd/import-profile",
    bodyKey: "profile",
    emptyInput: "вставь username или ссылку на profile letterboxd",
    lookingUp: "смотрим public profile letterboxd...",
    fetching: "читаем diary и watched...",
    failed: "не удалось импортировать profile Letterboxd",
    found: (count: number) => `готово: нашли ${count} фильм(ов) в letterboxd`,
  },
} as const;

export function useImports(deps: { items: DbItem[]; loadLibrary: () => void; setTab: (tab: Tab) => void }) {
  const { items, loadLibrary, setTab } = deps;
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  const [spotifyProfileName, setSpotifyProfileName] = useState<string | null>(null);
  const [connectedProfiles, setConnectedProfiles] = useState<{
    lastfm: { profile: string; lastSyncedAt: string | null } | null;
    letterboxd: { profile: string; lastSyncedAt: string | null } | null;
  }>({ lastfm: null, letterboxd: null });
  const [spotifySyncing, setSpotifySyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const csvImportRef = useRef<HTMLInputElement | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importStatus, setImportStatus] = useState("");
  const [imported, setImported] = useState<ImportedItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<Set<number>>(new Set());
  const [savingImported, setSavingImported] = useState(false);
  const [selectedImportService, setSelectedImportService] = useState<ImportService | null>(null);
  const [lastfmProfileInput, setLastfmProfileInput] = useState("");
  const [letterboxdProfileInput, setLetterboxdProfileInput] = useState("");
  const [yandexMusicUrl, setYandexMusicUrl] = useState("");

  async function importCsvPlatform(platform: Exclude<ImportPlatform, "spotify">, file: File) {
    setImportLoading(true);
    setImportError("");
    try {
      const text = await file.text();
      const drafts = parseImportedFile(platform, text);
      const result: ImportedItem[] = drafts.map((item) => ({
        type: item.type,
        source: platform,
        title: item.title,
        creator: item.authorOrArtist || undefined,
        consumedAt: item.consumedAt ?? undefined,
        timeOrigin: item.timeOrigin ?? undefined,
      }));
      if (result.length === 0) {
        setImportError("ничего не нашли в этом файле");
        return;
      }
      setImported(result);
      setSelectedIdx(new Set(result.map((_, i) => i)));
      setSelectedImportService(null);
    } catch (e: any) {
      setImportError(e?.message ?? "ошибка при чтении файла");
    } finally {
      setImportLoading(false);
    }
  }

  async function importYandexMusicPlaylist() {
    const url = yandexMusicUrl.trim();
    if (!url) {
      setImportError("вставь публичную ссылку на плейлист Яндекс.Музыки");
      return;
    }
    setImportLoading(true);
    setImportError("");
    setImportStatus("читаем плейлист Яндекс.Музыки...");
    try {
      const res = await fetch("/api/yandex-music/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await safeJson(res);
      if (!res.ok) throw new Error(json?.error ?? "не удалось прочитать плейлист");
      const result = toYandexTracks(json?.items);
      if (!result.length) throw new Error("в этом плейлисте не нашлось доступных треков");
      setImported(result);
      setSelectedIdx(new Set(result.map((_, index) => index)));
      setYandexMusicUrl("");
      setImportStatus(`нашли ${result.length} трек(ов) — выбери, что добавить`);
    } catch (error: any) {
      setImportError(error?.message ?? "не удалось импортировать плейлист Яндекс.Музыки");
    } finally {
      setImportLoading(false);
    }
  }

  function toggleImported(i: number) {
    const next = new Set(selectedIdx);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedIdx(next);
  }

  async function runImport(files: File[]) {
    setImportError(""); setImportLoading(true); setImported([]); setSelectedIdx(new Set());
    try {
      const selectedFiles = files.filter((file) => file.type?.startsWith("image/")).slice(0, 10);
      const collected: ImportedItem[] = [];
      let failedCount = 0;

      for (const file of selectedFiles) {
        const form = new FormData();
        form.append("file", file);
        const { res, json } = await apiFetch("/api/import-image", { method: "POST", body: form, });
        if (!res.ok) {
          failedCount += 1;
          continue;
        }
        const list: ImportedItem[] = json?.items ?? [];
        if (list.length === 0) {
          failedCount += 1;
          continue;
        }
        collected.push(...list);
      }

      if (collected.length === 0) {
        setImportError("не смог разобрать контент на этих изображениях. попробуй еще раз: лучше работают скриншоты, фото книжной полки, обложек книг, альбомов и постеров.");
        return;
      }

      setImported(collected);
      setSelectedIdx(new Set(collected.map((_, i) => i)));

      if (failedCount > 0) {
        setImportError(`не всё удалось разобрать: ${failedCount} изображ. попробуй еще раз или загрузи более четкие фото/скриншоты.`);
      }
    } catch (e: any) {
      setImportError(e?.message ?? "Network error");
    } finally {
      setImportLoading(false);
    }
  }

  async function saveSelected(itemsToSave: ImportedItem[]) {
    const { res, json } = await apiFetch(`${window.location.origin}/api/items/bulk`, { method: "POST", body: JSON.stringify({ items: itemsToSave.map((it) => ({ type: it.type, source: it.source, title: it.title, creator: it.creator ?? null, consumedAt: it.consumedAt ?? null, timeOrigin: it.timeOrigin ?? null, })),
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  }

  async function saveSelectedImported() {
    setSavingImported(true); setImportError("");
    try {
      const selected = imported.filter((_, i) => selectedIdx.has(i));
      if (selected.length === 0) { setImportError("Ничего не выбрано"); return; }
      await saveSelected(selected);
      setImported([]); setSelectedIdx(new Set());
      await loadLibrary();
      setTab("library");
    } catch (e: any) {
      setImportError(e?.message ?? "Ошибка сохранения");
    } finally {
      setSavingImported(false);
    }
  }

  function startImportService(service: ImportService) {
    if (service.id === "spotify") {
      setSelectedImportService(null);
      if (spotifyConnected) {
        syncSpotify();
      } else {
        connectSpotify();
      }
      return;
    }
    setSelectedImportService(service);
  }





  async function importProfileWeb(platform: "lastfm" | "letterboxd") {
    const config = PROFILE_IMPORTS[platform];
    const profile = (platform === "lastfm" ? lastfmProfileInput : letterboxdProfileInput).trim();
    if (!profile) {
      setImportError(config.emptyInput);
      return;
    }
    setImportLoading(true);
    setImportError("");
    setImportStatus(config.lookingUp);
    try {
      setImportStatus(config.fetching);
      const res = await fetch(config.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [config.bodyKey]: profile }),
      });
      const json = await safeJson(res);
      if (!res.ok) {
        setImportError(json?.error ?? config.failed);
        return;
      }
      const result = toImportedItems(json?.items, platform);
      setImported(result);
      setSelectedIdx(new Set(result.map((_: ImportedItem, i: number) => i)));
      setSelectedImportService(null);
      setConnectedProfiles((current) => ({
        ...current,
        [platform]: { profile, lastSyncedAt: new Date().toISOString() },
      }));
      setImportStatus(result.length > 0 ? config.found(result.length) : "ничего не нашли в этом профиле");
    } catch (e: any) {
      setImportError(e?.message ?? config.failed);
    } finally {
      setImportLoading(false);
    }
  }

  function confirmCsvImport() {
    csvImportRef.current?.click();
  }

  async function checkSpotify() {
    try {
      const { res, json } = await apiFetch("/api/spotify/status");
      setSpotifyConnected(json?.connected ?? false);
      setSpotifyProfileName(json?.profile?.displayName ?? null);
    } catch {
      setSpotifyConnected(false);
      setSpotifyProfileName(null);
    }
  }

  async function disconnectSpotify(deleteContent = false) {
    setSpotifySyncing(true);
    setImportError("");
    setImportStatus(deleteContent ? "отвязываем spotify и чистим импорт..." : "отвязываем spotify...");
    try {
      const { res, json } = await apiFetch(`/api/spotify/sync?deleteContent=${deleteContent ? "1" : "0"}`, { method: "DELETE", });
      if (!res.ok) {
        setImportError(json?.error ?? "не удалось отвязать spotify");
        return;
      }
      setSpotifyConnected(false);
      setSpotifyProfileName(null);
      await loadLibrary();
      setImportStatus(
        deleteContent
          ? `готово: spotify отвязали и убрали ${json?.deletedItems ?? 0} айтем(ов)`
          : "готово: spotify больше не подключен"
      );
    } catch (e: any) {
      setImportError(e?.message ?? "не удалось отвязать spotify");
    } finally {
      setSpotifySyncing(false);
    }
  }

  async function connectSpotify() {
    const initData = getTgInitData();
    const url = `/api/spotify/auth?initData=${encodeURIComponent(initData)}`;
    const tg = (window as any).Telegram?.WebApp;
    tg?.openLink ? tg.openLink(url) : window.open(url, "_blank");
    // Проверяем подключение через 5 секунд
    setTimeout(() => checkSpotify(), 5000);
  }

  async function syncSpotify() {
    setSpotifySyncing(true);
    try {
      const { res, json } = await apiFetch("/api/spotify/sync", { method: "POST" });
      if (json?.ok) loadLibrary();
    } catch {}
    finally { setSpotifySyncing(false); }
  }

  async function disconnectConnectedProfile(
    platform: "lastfm" | "letterboxd",
    deleteContent = false
  ) {
    setImportLoading(true);
    setImportError("");
    setImportStatus(deleteContent ? "отвязываем источник и чистим импорт..." : "отвязываем источник...");
    try {
      const { res, json } = await apiFetch("/api/v2/connected-sources", { method: "DELETE", body: JSON.stringify({ platform, deleteContent }) });
      if (!res.ok) {
        setImportError(json?.error ?? "не удалось отвязать источник");
        return;
      }
      setConnectedProfiles((current) => ({ ...current, [platform]: null }));
      if (platform === "lastfm") setLastfmProfileInput("");
      if (platform === "letterboxd") setLetterboxdProfileInput("");
      await loadLibrary();
      setImportStatus(
        deleteContent
          ? `готово: отвязали ${platform} и убрали ${json?.deletedItems ?? 0} айтем(ов)`
          : `готово: ${platform} больше не подключен`
      );
    } catch (e: any) {
      setImportError(e?.message ?? "не удалось отвязать источник");
    } finally {
      setImportLoading(false);
    }
  }

  async function loadConnectedProfiles() {
    try {
      const { res, json } = await apiFetch("/api/v2/connected-sources");
      if (!res.ok) return;
      const next = { lastfm: null, letterboxd: null } as typeof connectedProfiles;
      for (const source of Array.isArray(json?.sources) ? json.sources : []) {
        if (source?.platform === "lastfm") {
          next.lastfm = { profile: source.profile, lastSyncedAt: source.lastSyncedAt ?? null };
        }
        if (source?.platform === "letterboxd") {
          next.letterboxd = { profile: source.profile, lastSyncedAt: source.lastSyncedAt ?? null };
        }
      }
      setConnectedProfiles(next);
      if (next.lastfm?.profile) setLastfmProfileInput(next.lastfm.profile);
      if (next.letterboxd?.profile) setLetterboxdProfileInput(next.letterboxd.profile);
    } catch {}
  }

  return {
    spotifyConnected, spotifyProfileName, connectedProfiles, spotifySyncing,
    fileRef, csvImportRef, importLoading, importError, importStatus, imported,
    selectedIdx, savingImported, selectedImportService,
    lastfmProfileInput, letterboxdProfileInput, yandexMusicUrl,
    setImportError, setImportStatus, setImported, setSelectedIdx, setImportLoading,
    setSelectedImportService, setLastfmProfileInput, setLetterboxdProfileInput, setYandexMusicUrl,
    importCsvPlatform, importYandexMusicPlaylist, toggleImported, runImport, saveSelected,
    saveSelectedImported, startImportService, importProfileWeb, confirmCsvImport,
    checkSpotify, disconnectSpotify, connectSpotify, syncSpotify,
    disconnectConnectedProfile, loadConnectedProfiles,
  };
}
