import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import { useEffect, useMemo, useState } from "react";
import {
  clampText,
  getDisplayName,
  LEGACY_ANALYSIS_KEYS,
  LEGACY_IMPORT_KEYS,
  LEGACY_LIBRARY_KEYS,
  normalizeLibrary,
  STORAGE_KEY_ANALYSIS,
  STORAGE_KEY_IMPORT,
  STORAGE_KEY_LIBRARY,
  uid,
  type AnalysisRun,
  type ContentType,
  type LibraryItem,
  type SourceType,
  type Tab,
  type TgUser,
} from "../shared/everyyou/domain";
import {
  analyzeScreenshot,
  createItem,
  deleteItem,
  ensureGuestSession,
  fetchBackendHealth,
  fetchItems,
  fetchSpotifyConnectionStatus,
  fetchSpotifyPlaylists,
  getSpotifyOAuthUrl,
  importFromSpotifyUser,
  importFromSpotifyUrl,
  runVibeCheck,
  updateItem,
} from "../lib/api";
import { parseImportedFile } from "../lib/fileImports";

type TypeFilter = ContentType | "all";
type SourceFilter = SourceType | "all";
type SyncStatus = "idle" | "syncing" | "online" | "offline";
type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};

async function loadJSON<T>(mainKey: string, legacyKeys: string[], fallback: T): Promise<T> {
  const mainRaw = await AsyncStorage.getItem(mainKey);
  if (mainRaw) {
    try {
      return JSON.parse(mainRaw) as T;
    } catch {
      return fallback;
    }
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (!legacyRaw) continue;
    try {
      const parsed = JSON.parse(legacyRaw) as T;
      await AsyncStorage.setItem(mainKey, JSON.stringify(parsed));
      return parsed;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

async function loadNumber(mainKey: string, legacyKeys: string[]) {
  const mainRaw = await AsyncStorage.getItem(mainKey);
  if (mainRaw != null) {
    const n = Number(mainRaw);
    return Number.isFinite(n) ? n : 0;
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw == null) continue;
    const n = Number(legacyRaw);
    if (Number.isFinite(n)) {
      await AsyncStorage.setItem(mainKey, String(n));
      return n;
    }
  }

  return 0;
}

export function useEveryYouApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [user, setUser] = useState<TgUser | null>({ first_name: "ios", last_name: "друг" });
  const [type, setType] = useState<ContentType | "">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [title, setTitle] = useState("");
  const [authorOrArtist, setAuthorOrArtist] = useState("");
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [isScreenshotImporting, setIsScreenshotImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyProfileName, setSpotifyProfileName] = useState<string | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(false);
  const [spotifyPlaylistLoading, setSpotifyPlaylistLoading] = useState(false);
  const [fileImportStatus, setFileImportStatus] = useState<string | null>(null);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRun[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [apiToken, setApiToken] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [syncMessage, setSyncMessage] = useState("локальная библиотека");

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const storedLibrary = normalizeLibrary(
        await loadJSON<unknown[]>(STORAGE_KEY_LIBRARY, LEGACY_LIBRARY_KEYS, [])
      );
      const storedImportCount = await loadNumber(STORAGE_KEY_IMPORT, LEGACY_IMPORT_KEYS);
      const storedAnalysis = await loadJSON<AnalysisRun[]>(
        STORAGE_KEY_ANALYSIS,
        LEGACY_ANALYSIS_KEYS,
        []
      );

      let nextLibrary = storedLibrary;
      let nextUser: TgUser | null = { first_name: "ios", last_name: "друг" };
      let nextToken: string | null = null;
      let nextSyncStatus: SyncStatus = "offline";
      let nextSyncMessage = "локальная библиотека";

      try {
        if (mounted) {
          setSyncStatus("syncing");
          setSyncMessage("подключаем backend...");
        }

        const health = await fetchBackendHealth();
        if (!health.env.everyyouAppAuthSecret) {
          throw new Error("backend reachable, but EVERYYOU_APP_AUTH_SECRET is missing");
        }

        const session = await ensureGuestSession("ios friend");
        const remoteLibrary = await fetchItems(session.token);
        nextLibrary = remoteLibrary;
        nextToken = session.token;
        nextUser = { first_name: session.name, last_name: "" };
        nextSyncStatus = "online";
        nextSyncMessage = "данные синхронизируются с сервером";
      } catch (error) {
        const message = error instanceof Error ? error.message : "backend недоступен";
        nextSyncStatus = "offline";
        nextSyncMessage = message;
      }

      if (!mounted) return;
      setLibrary(nextLibrary);
      setImportedCount(storedImportCount);
      setAnalysisHistory(storedAnalysis);
      setUser(nextUser);
      setApiToken(nextToken);
      setSyncStatus(nextSyncStatus);
      setSyncMessage(nextSyncMessage);
      setLoaded(true);
    }

    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPhIdx((current) => current + 1), 2500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!apiToken) return;

    let cancelled = false;
    async function loadSpotifyStatus() {
      try {
        const status = await fetchSpotifyConnectionStatus(apiToken);
        if (cancelled) return;
        setSpotifyConnected(status.connected);
        setSpotifyProfileName(status.profile?.displayName ?? null);
      } catch {
        if (cancelled) return;
        setSpotifyConnected(false);
        setSpotifyProfileName(null);
      }
    }

    loadSpotifyStatus();
    return () => {
      cancelled = true;
    };
  }, [apiToken]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_LIBRARY, JSON.stringify(library)).catch(() => undefined);
  }, [library, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_IMPORT, String(importedCount)).catch(() => undefined);
  }, [importedCount, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_ANALYSIS, JSON.stringify(analysisHistory)).catch(() => undefined);
  }, [analysisHistory, loaded]);

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const canSave = useMemo(
    () => Boolean(type && source && clampText(title) && clampText(authorOrArtist)),
    [authorOrArtist, source, title, type]
  );
  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return library.find((item) => item.id === selectedId) ?? null;
  }, [library, selectedId]);
  const visibleLibrary = useMemo(() => {
    return library.filter((item) => {
      const typeMatch = typeFilter === "all" || item.type === typeFilter;
      const sourceMatch = sourceFilter === "all" || item.source === sourceFilter;
      return typeMatch && sourceMatch;
    });
  }, [library, sourceFilter, typeFilter]);
  const counters = useMemo(() => {
    const byType: Record<ContentType, number> = { music: 0, book: 0, film: 0 };
    library.forEach((item) => {
      byType[item.type] += 1;
    });
    return { byType, total: library.length };
  }, [library]);

  function resetForm() {
    setType("");
    setSource("");
    setTitle("");
    setAuthorOrArtist("");
    setSpotifyUrl("");
  }

  async function addItem() {
    if (!canSave) return;
    const draft: LibraryItem = {
      id: uid(),
      type: type as ContentType,
      source: source as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
      createdAt: Date.now(),
    };

    if (apiToken) {
      try {
        setSyncStatus("syncing");
        const saved = await createItem(apiToken, draft);
        setLibrary((current) => [saved, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        resetForm();
        setTab("library");
        setSelectedId(saved.id);
        return;
      } catch {
        setLibrary((current) => [draft, ...current]);
        setSyncStatus("offline");
        setSyncMessage("не удалось сохранить на сервер, айтем добавлен локально");
      }
    } else {
      setLibrary((current) => [draft, ...current]);
    }

    resetForm();
    setTab("library");
    setSelectedId(draft.id);
  }

  function startEdit(id: string) {
    const item = library.find((entry) => entry.id === id);
    if (!item) return;
    setEditingId(id);
    setType(item.type);
    setSource(item.source);
    setTitle(item.title);
    setAuthorOrArtist(item.authorOrArtist);
    setTab("add");
  }

  async function saveEdit() {
    if (!editingId || !canSave) return;

    const updatedDraft = {
      id: editingId,
      type: type as ContentType,
      source: source as SourceType,
      title: clampText(title).toLowerCase(),
      authorOrArtist: clampText(authorOrArtist).toLowerCase(),
    };

    if (apiToken) {
      try {
        setSyncStatus("syncing");
        const saved = await updateItem(apiToken, updatedDraft);
        setLibrary((current) => current.map((item) => (item.id === editingId ? saved : item)));
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } catch {
        setLibrary((current) =>
          current.map((item) => (item.id === editingId ? { ...item, ...updatedDraft } : item))
        );
        setSyncStatus("offline");
        setSyncMessage("не удалось обновить сервер, изменения сохранены локально");
      }
    } else {
      setLibrary((current) =>
        current.map((item) => (item.id === editingId ? { ...item, ...updatedDraft } : item))
      );
    }

    setSelectedId(editingId);
    setEditingId(null);
    resetForm();
    setTab("library");
  }

  async function removeItem(id: string) {
    if (apiToken) {
      try {
        setSyncStatus("syncing");
        await deleteItem(apiToken, id);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } catch {
        setSyncStatus("offline");
        setSyncMessage("не удалось удалить на сервере, айтем убран локально");
      }
    }

    setLibrary((current) => current.filter((item) => item.id !== id));
    if (selectedId === id) setSelectedId(null);
    if (editingId === id) setEditingId(null);
  }

  async function runFakeImport() {
    if (isImporting) return;
    setIsImporting(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    const fakeItems: LibraryItem[] = [
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "about today",
        authorOrArtist: "the national",
        createdAt: Date.now(),
      },
      {
        id: uid(),
        type: "music",
        source: "import_spotify",
        title: "codex",
        authorOrArtist: "radiohead",
        createdAt: Date.now(),
      },
    ];

    setImportedCount((current) => current + 37);
    setLibrary((current) => [...fakeItems, ...current]);
    setIsImporting(false);
    setTab("library");
  }

  async function importFromScreenshot() {
    if (isScreenshotImporting) return;

    try {
      setIsScreenshotImporting(true);
      setScreenshotStatus("открываем галерею...");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || !result.assets[0]?.base64) {
        setScreenshotStatus("импорт отменен");
        setIsScreenshotImporting(false);
        return;
      }

      setScreenshotStatus("анализируем скриншот через openai...");
      const parsedItems = await analyzeScreenshot({
        imageBase64: result.assets[0].base64,
        mimeType: result.assets[0].mimeType ?? "image/jpeg",
      });

      if (parsedItems.length === 0) {
        setScreenshotStatus("ничего уверенно не распознали");
        setIsScreenshotImporting(false);
        return;
      }

      const importedItems: LibraryItem[] = parsedItems.map((item) => ({
        id: uid(),
        type: item.type,
        source: "manual",
        title: item.title,
        authorOrArtist: item.authorOrArtist,
        createdAt: Date.now(),
      }));

      if (apiToken) {
        const savedItems: LibraryItem[] = [];
        for (const item of importedItems) {
          const saved = await createItem(apiToken, item);
          savedItems.push(saved);
        }
        setLibrary((current) => [...savedItems, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) => [...importedItems, ...current]);
      }

      setScreenshotStatus(`добавили ${importedItems.length} айтем(ов) из скриншота`);
      setTab("library");
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось проанализировать скриншот";
      setScreenshotStatus(message);
    } finally {
      setIsScreenshotImporting(false);
    }
  }

  async function importSpotifyLink() {
    const normalizedUrl = spotifyUrl.trim();
    if (!normalizedUrl) {
      setSpotifyStatus("вставь spotify track, album или playlist link");
      return;
    }

    try {
      setSpotifyStatus("тянем данные из spotify...");
      const parsedItems = await importFromSpotifyUrl(normalizedUrl);

      if (parsedItems.length === 0) {
        setSpotifyStatus("spotify ничего не вернул");
        return;
      }

      const importedItems: LibraryItem[] = parsedItems.map((item) => ({
        id: uid(),
        type: item.type,
        source: "import_spotify",
        title: item.title,
        authorOrArtist: item.authorOrArtist,
        createdAt: Date.now(),
      }));

      if (apiToken) {
        const savedItems: LibraryItem[] = [];
        for (const item of importedItems) {
          const saved = await createItem(apiToken, item);
          savedItems.push(saved);
        }
        setLibrary((current) => [...savedItems, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) => [...importedItems, ...current]);
      }

      setImportedCount((current) => current + importedItems.length);
      setSpotifyStatus(`добавили ${importedItems.length} трек(ов) из spotify`);
      setSpotifyUrl("");
      setTab("library");
    } catch (error) {
      const message = error instanceof Error ? error.message : "spotify import failed";
      setSpotifyStatus(message);
    }
  }

  async function importPlatformFile(
    platform: "livelib" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi"
  ) {
    try {
      setFileImportStatus("открываем файлы...");
      const result = await DocumentPicker.getDocumentAsync({
        multiple: false,
        copyToCacheDirectory: true,
        type: ["text/csv", "text/plain", "application/vnd.ms-excel"],
      });

      if (result.canceled || !result.assets[0]?.uri) {
        setFileImportStatus("импорт отменен");
        return;
      }

      setFileImportStatus("читаем файл...");
      const fileText = await fetch(result.assets[0].uri).then((response) => response.text());
      const parsedItems = parseImportedFile(platform, fileText);

      if (parsedItems.length === 0) {
        setFileImportStatus("ничего не удалось импортировать");
        return;
      }

      if (apiToken) {
        let created = 0;
        for (const item of parsedItems) {
          await createItem(apiToken, item);
          created += 1;
        }
        const remoteLibrary = await fetchItems(apiToken);
        setLibrary(remoteLibrary);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        setFileImportStatus(`добавили ${created} айтем(ов) из файла`);
      } else {
        setLibrary((current) => [
          ...parsedItems.map((item) => ({
            id: uid(),
            ...item,
            createdAt: Date.now(),
          })),
          ...current,
        ]);
        setFileImportStatus(`добавили ${parsedItems.length} айтем(ов) локально`);
      }

      setTab("library");
    } catch (error) {
      const message = error instanceof Error ? error.message : "file import failed";
      setFileImportStatus(message);
    }
  }

  async function refreshSpotifyConnection(showSuccessMessage = false) {
    if (!apiToken) {
      setSpotifyStatus("backend token missing");
      return false;
    }

    try {
      const status = await fetchSpotifyConnectionStatus(apiToken);
      setSpotifyConnected(status.connected);
      setSpotifyProfileName(status.profile?.displayName ?? null);
      if (!status.connected) {
        setSpotifyStatus("spotify пока не подключен");
        return false;
      }
      if (showSuccessMessage) {
        setSpotifyStatus(
          status.profile?.displayName
            ? `spotify подключен: ${status.profile.displayName}`
            : "spotify подключен"
        );
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось проверить spotify";
      setSpotifyStatus(message);
      return false;
    }
  }

  async function connectSpotifyAccount() {
    if (!apiToken || spotifyOAuthLoading) return;

    try {
      setSpotifyOAuthLoading(true);
      setSpotifyStatus("открываем spotify login...");
      const { authUrl } = await getSpotifyOAuthUrl(apiToken);
      const canOpen = await Linking.canOpenURL(authUrl);
      if (!canOpen) {
        throw new Error("не удалось открыть spotify login");
      }
      await Linking.openURL(authUrl);
      setSpotifyStatus("заверши логин в браузере, потом вернись и нажми обновить spotify");
    } catch (error) {
      const message = error instanceof Error ? error.message : "spotify oauth failed";
      setSpotifyStatus(message);
    } finally {
      setSpotifyOAuthLoading(false);
    }
  }

  async function loadSpotifyPlaylistsList() {
    if (!apiToken || spotifyPlaylistLoading) return;

    try {
      setSpotifyPlaylistLoading(true);
      const statusOk = spotifyConnected ? true : await refreshSpotifyConnection();
      if (!statusOk) return;
      setSpotifyStatus("грузим плейлисты...");
      const data = await fetchSpotifyPlaylists(apiToken);
      setSpotifyPlaylists(data.playlists);
      setSpotifyStatus(
        data.playlists.length > 0
          ? `нашли ${data.playlists.length} spotify playlist(s)`
          : "плейлисты не нашлись"
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось загрузить плейлисты";
      setSpotifyStatus(message);
    } finally {
      setSpotifyPlaylistLoading(false);
    }
  }

  async function importSpotifyAccountSource(
    input: { mode: "liked" | "recently_played" | "playlist"; playlistId?: string },
    successLabel: string
  ) {
    if (!apiToken) {
      setSpotifyStatus("backend token missing");
      return;
    }

    try {
      const statusOk = spotifyConnected ? true : await refreshSpotifyConnection();
      if (!statusOk) return;

      setSpotifyStatus(`тянем ${successLabel} из spotify...`);
      const result = await importFromSpotifyUser(apiToken, input);
      setImportedCount((current) => current + result.importedCount);

      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setSyncStatus("online");
      setSyncMessage("данные синхронизируются с сервером");
      if ((result.skippedCount ?? 0) > 0) {
        setSpotifyStatus(
          `добавили ${result.importedCount} трек(ов) из ${successLabel}, пропустили ${result.skippedCount} дублей`
        );
      } else {
        setSpotifyStatus(`добавили ${result.importedCount} трек(ов) из ${successLabel}`);
      }
      setTab("library");
    } catch (error) {
      const message = error instanceof Error ? error.message : "spotify import failed";
      setSpotifyStatus(message);
    }
  }

  async function runFakeAnalysis() {
    if (analysisRunning) return;
    setAnalysisRunning(true);

    try {
      if (apiToken) {
        const data = await runVibeCheck(apiToken);
        const result: AnalysisRun = {
          id: uid(),
          createdAt: Date.now(),
          itemCount: data.itemCount,
          summary: data.summary,
          highlights: data.highlights,
        };

        setAnalysisResult(result);
        setAnalysisHistory([result]);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 900));

      const total = counters.total;
      const byType = counters.byType;

      const result: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: total,
        summary:
          total === 0
            ? "пока пусто. добавьте пару айтемов и мы начнем собирать ваш паттерн вкуса."
            : `в библиотеке ${total} айтемов. музыка: ${byType.music}, книги: ${byType.book}, фильмы: ${byType.film}.`,
        highlights:
          total === 0
            ? ["можно начать с импорта spotify", "или добавить что-то вручную"]
            : [
                "это мобильный демо-вайбчек, логика пока такая же как в telegram mini app",
                "следующий шаг это реальный backend и авторизация вне Telegram",
                "после этого сюда можно подключить настоящий анализ и рекомендации",
              ],
      };

      setAnalysisResult(result);
      setAnalysisHistory([result]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "vibe check failed";
      const fallback: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: counters.total,
        summary: `не удалось провести серверный вайбчек: ${message}`,
        highlights: ["проверь OPENAI_API_KEY на backend", "и повтори попытку"],
      };
      setAnalysisResult(fallback);
      setAnalysisHistory([fallback]);
    } finally {
      setAnalysisRunning(false);
    }
  }

  return {
    tab,
    setTab,
    displayName,
    syncStatus,
    syncMessage,
    editingId,
    isImporting,
    isScreenshotImporting,
    importedCount,
    screenshotStatus,
    spotifyUrl,
    spotifyStatus,
    spotifyConnected,
    spotifyProfileName,
    spotifyPlaylists,
    spotifyOAuthLoading,
    spotifyPlaylistLoading,
    fileImportStatus,
    type,
    source,
    title,
    authorOrArtist,
    phIdx,
    canSave,
    typeFilter,
    sourceFilter,
    selectedItem,
    visibleLibrary,
    counters,
    analysisRunning,
    analysisResult,
    analysisHistory,
    setType,
    setSource,
    setTitle,
    setAuthorOrArtist,
    addItem,
    saveEdit,
    startEdit,
    removeItem,
    runFakeImport,
    importFromScreenshot,
    setSpotifyUrl,
    importSpotifyLink,
    connectSpotifyAccount,
    refreshSpotifyConnection: () => refreshSpotifyConnection(true),
    loadSpotifyPlaylists: loadSpotifyPlaylistsList,
    importSpotifyLikedSongs: () => importSpotifyAccountSource({ mode: "liked" }, "liked songs"),
    importSpotifyRecentlyPlayed: () =>
      importSpotifyAccountSource({ mode: "recently_played" }, "recently played"),
    importSpotifyPlaylist: (playlistId: string, playlistName: string) =>
      importSpotifyAccountSource({ mode: "playlist", playlistId }, `playlist ${playlistName}`),
    importLivelibFile: () => importPlatformFile("livelib"),
    importLetterboxdFile: () => importPlatformFile("letterboxd"),
    importLastfmFile: () => importPlatformFile("lastfm"),
    importKinopoiskFile: () => importPlatformFile("kinopoisk"),
    importMubiFile: () => importPlatformFile("mubi"),
    cancelEdit: () => {
      setEditingId(null);
      resetForm();
      setTab("library");
    },
    setTypeFilter: (value: TypeFilter) => {
      setTypeFilter(value);
      setSelectedId(null);
    },
    setSourceFilter: (value: SourceFilter) => {
      setSourceFilter(value);
      setSelectedId(null);
    },
    setSelectedId,
    runFakeAnalysis,
    openAnalysisResult: setAnalysisResult,
  };
}
