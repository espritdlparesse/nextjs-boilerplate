import { useTimeline } from "./useTimeline";
import type { DateInsight, TimelineSpreadPreset } from "./timelineTypes";
import type { ConnectedSourceState, PendingImageItem, SpotifyPlaylist } from "./importTypes";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Linking } from "react-native";
import { Dispatch, SetStateAction, useEffect, useRef, useState } from "react";
import { clampText, STORAGE_KEY_IMPORT, uid, type LibraryItem, type Tab } from "../shared/everyyou/domain";
import { analyzeScreenshot, createItem, disconnectConnectedSource, disconnectSpotifyConnection, fetchItems, fetchSpotifyConnectionStatus, fetchSpotifyPlaylists, getSpotifyOAuthUrl, importFromSpotifyUser, importFromSpotifyUrl, saveConnectedSource , importFromLastfmProfile, importFromLetterboxdProfile } from "../lib/api";
import { parseImportedFile } from "../lib/fileImports";
type SyncStatus = "idle" | "syncing" | "online" | "offline";

type ProfileSourcePlatform = "lastfm" | "letterboxd";

const PROFILE_SOURCES: Record<ProfileSourcePlatform, {
  label: string;
  emptyInput: string;
  lookingUp: string;
  fetching: string;
  failed: string;
  analyticsEvent: string;
  unit: (count: number) => string;
  fetchItems: (profile: string) => Promise<Omit<LibraryItem, "id">[]>;
}> = {
  lastfm: {
    label: "last.fm",
    emptyInput: "введи username last.fm",
    lookingUp: "смотрим профиль last.fm...",
    fetching: "тянем recent tracks...",
    failed: "не удалось импортировать профиль last.fm",
    analyticsEvent: "lastfm_profile_import_completed",
    unit: () => "трек(ов)",
    fetchItems: importFromLastfmProfile,
  },
  letterboxd: {
    label: "letterboxd",
    emptyInput: "вставь username или ссылку на profile letterboxd",
    lookingUp: "смотрим public profile letterboxd...",
    fetching: "читаем diary и watched...",
    failed: "не удалось импортировать profile Letterboxd",
    analyticsEvent: "letterboxd_profile_import_completed",
    unit: () => "фильм(ов)",
    fetchItems: importFromLetterboxdProfile,
  },
};

export function useLibraryImports(deps: {
  apiToken: string | null;
  library: LibraryItem[];
  setLibrary: Dispatch<SetStateAction<LibraryItem[]>>;
  setSelectedId: (id: string | null) => void;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncMessage: (message: string) => void;
  setToastMessage: (message: string | null) => void;
  setTab: (tab: Tab) => void;
  timeline: ReturnType<typeof useTimeline>;
  loaded: boolean;
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
}) {
  const { apiToken, library, setLibrary, setSelectedId, setSyncStatus, setSyncMessage, setToastMessage, setTab, timeline, loaded, fireAnalytics } = deps;
  const [isImporting, setIsImporting] = useState(false);
  const [isScreenshotImporting, setIsScreenshotImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [screenshotStatus, setScreenshotStatus] = useState<string | null>(null);
  const [pendingImageItems, setPendingImageItems] = useState<PendingImageItem[]>([]);
  const [selectedPendingImageId, setSelectedPendingImageId] = useState<string | null>(null);
  const [confirmingPendingImageImport, setConfirmingPendingImageImport] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyProfileName, setSpotifyProfileName] = useState<string | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(false);
  const [spotifyPlaylistLoading, setSpotifyPlaylistLoading] = useState(false);
  const [lastfmUsername, setLastfmUsername] = useState("");
  const [letterboxdProfile, setLetterboxdProfile] = useState("");
  const [connectedSources, setConnectedSources] = useState<ConnectedSourceState>({
    lastfm: null,
    letterboxd: null,
  });
  const [fileImportStatus, setFileImportStatus] = useState<string | null>(null);
  const [fileImportBusy, setFileImportBusy] = useState(false);
  const [fileImportCanCancel, setFileImportCanCancel] = useState(false);
  const filePickerBusyRef = useRef(false);
  const filePickerCancelledRef = useRef(false);
  const [screenshotDateInsight, setScreenshotDateInsight] = useState<DateInsight | null>(null);
  const [spotifyDateInsight, setSpotifyDateInsight] = useState<DateInsight | null>(null);
  const [fileImportDateInsight, setFileImportDateInsight] = useState<DateInsight | null>(null);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_IMPORT, String(importedCount)).catch(() => undefined);
  }, [importedCount, loaded]);

  async function persistImportedLibraryItems(
    items: Array<
      Pick<LibraryItem, "type" | "source" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin">
    >,
    options: {
      successLabel: string;
      successToast: string;
      analyticsEvent: string;
      analyticsProperties?: Record<string, unknown>;
      statusSetter: (message: string | null) => void;
      dateInsightSetter: (value: DateInsight | null) => void;
    }
  ) {
    if (items.length === 0) {
      options.statusSetter("ничего не нашли");
      return;
    }

    if (apiToken) {
      let created = 0;
      for (const item of items) {
        await createItem(apiToken, item);
        created += 1;
      }
      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setSyncStatus("online");
      setSyncMessage("данные синхронизируются с сервером");
      const coverage = timeline.describeDateCoverage(items);
      options.dateInsightSetter(timeline.buildDateInsight(items));
      options.statusSetter(`${options.successLabel}${coverage ? ` · ${coverage}` : ""}`);
      setToastMessage(options.successToast);
      fireAnalytics(options.analyticsEvent, { count: created, ...(options.analyticsProperties ?? {}) });
    } else {
      setLibrary((current) => [
        ...items.map((item) => ({
          id: uid(),
          ...item,
          createdAt: Date.now(),
        })),
        ...current,
      ]);
      const coverage = timeline.describeDateCoverage(items);
      options.dateInsightSetter(timeline.buildDateInsight(items));
      options.statusSetter(`${options.successLabel}${coverage ? ` · ${coverage}` : ""}`);
      setToastMessage(options.successToast);
      fireAnalytics(options.analyticsEvent, { count: items.length, mode: "local", ...(options.analyticsProperties ?? {}) });
    }

    setTab("library");
    timeline.setTimelinePromptVisible(items.some((item) => item.consumedAt == null));
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
    timeline.setTimelinePromptVisible(true);
  }

  async function importPlatformFile(
    platform: "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi"
  ) {
    if (filePickerBusyRef.current) {
      setFileImportStatus("уже открыт выбор файла");
      return;
    }

    filePickerBusyRef.current = true;
    try {
      setFileImportBusy(true);
      setFileImportCanCancel(true);
      filePickerCancelledRef.current = false;
      setFileImportStatus("открываем файлы...");
      setFileImportDateInsight(null);

      await new Promise((resolve) => setTimeout(resolve, 220));
      if (filePickerCancelledRef.current) {
        setFileImportStatus("пока не открываем файлы");
        return;
      }

      setFileImportCanCancel(false);
      setFileImportBusy(false);
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
        const coverage = timeline.describeDateCoverage(parsedItems);
        setFileImportDateInsight(timeline.buildDateInsight(parsedItems));
        setFileImportStatus(`добавили ${created} айтем(ов) из файла${coverage ? ` · ${coverage}` : ""}`);
        setToastMessage(`загрузили ${created} айтем(ов)`);
        fireAnalytics("file_import_completed", { platform, count: created });
      } else {
        setLibrary((current) => [
          ...parsedItems.map((item) => ({
            id: uid(),
            ...item,
            createdAt: Date.now(),
            consumedAt: undefined,
            timeOrigin: undefined,
          })),
          ...current,
        ]);
        const coverage = timeline.describeDateCoverage(parsedItems);
        setFileImportDateInsight(timeline.buildDateInsight(parsedItems));
        setFileImportStatus(
          `добавили ${parsedItems.length} айтем(ов) локально${coverage ? ` · ${coverage}` : ""}`
        );
        setToastMessage(`загрузили ${parsedItems.length} айтем(ов)`);
        fireAnalytics("file_import_completed", { platform, count: parsedItems.length, mode: "local" });
      }

      setTab("library");
      timeline.setTimelinePromptVisible(parsedItems.some((item) => item.consumedAt == null));
    } catch (error) {
      const message = error instanceof Error ? error.message : "file import failed";
      setFileImportStatus(message);
    } finally {
      setFileImportBusy(false);
      setFileImportCanCancel(false);
      setTimeout(() => {
        filePickerCancelledRef.current = false;
        filePickerBusyRef.current = false;
      }, 350);
    }
  }

  function cancelFileImportOpening() {
    if (!fileImportCanCancel) return;
    filePickerCancelledRef.current = true;
    setFileImportBusy(false);
    setFileImportCanCancel(false);
    setFileImportStatus("пока не открываем файлы");
  }

  async function importFromScreenshot() {
    if (isScreenshotImporting) return;

    try {
      setIsScreenshotImporting(true);
      setScreenshotStatus("открываем галерею...");
      setScreenshotDateInsight(null);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.9,
        base64: true,
      });

      if (result.canceled || !result.assets.length) {
        setScreenshotStatus("импорт отменен");
        setIsScreenshotImporting(false);
        return;
      }

      const assets = result.assets.filter((asset) => asset.base64);
      if (assets.length === 0) {
        setScreenshotStatus("в выбранных файлах не нашлось изображений");
        setIsScreenshotImporting(false);
        return;
      }

      const parsedItems: Awaited<ReturnType<typeof analyzeScreenshot>> = [];
      for (const [index, asset] of assets.entries()) {
        setScreenshotStatus(`анализируем изображения: ${index + 1}/${assets.length}...`);
        const chunk = await analyzeScreenshot({
          imageBase64: asset.base64 as string,
          mimeType: asset.mimeType ?? "image/jpeg",
        });
        parsedItems.push(...chunk);
      }

      if (parsedItems.length === 0) {
        setScreenshotStatus(
          "не могу отнести это ни к музыке, ни к книгам, ни к фильмам — попробуй другое изображение"
        );
        setIsScreenshotImporting(false);
        return;
      }

      const importedItems: PendingImageItem[] = parsedItems.map((item) => ({
        id: uid(),
        type: item.type,
        source: "manual",
        title: item.title,
        authorOrArtist: item.authorOrArtist,
        createdAt: Date.now(),
        consumedAt: undefined,
        timeOrigin: undefined,
      }));
      setPendingImageItems(importedItems);
      const coverage = timeline.describeDateCoverage(importedItems);
      setScreenshotDateInsight(timeline.buildDateInsight(importedItems));
      setScreenshotStatus(
        `нашли ${importedItems.length} айтем(ов), проверь перед сохранением${coverage ? ` · ${coverage}` : ""}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось проанализировать изображение";
      setScreenshotStatus(message);
    } finally {
      setIsScreenshotImporting(false);
    }
  }

  function updatePendingImageItem(
    id: string,
    patch: Partial<Pick<PendingImageItem, "type" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin">>
  ) {
    setPendingImageItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              title: patch.title != null ? clampText(patch.title).toLowerCase() : item.title,
              authorOrArtist:
                patch.authorOrArtist != null
                  ? clampText(patch.authorOrArtist).toLowerCase()
                  : item.authorOrArtist,
            }
          : item
      )
    );
  }

  function assignPendingImageItemTime(id: string, preset: TimelineSpreadPreset) {
    const [date] = timeline.buildSpreadDates(1, preset);
    updatePendingImageItem(id, { consumedAt: date, timeOrigin: "estimated" });
  }

  function removePendingImageItem(id: string) {
    setPendingImageItems((current) => current.filter((item) => item.id !== id));
    if (selectedPendingImageId === id) {
      setSelectedPendingImageId(null);
    }
  }

  function cancelPendingImageImport() {
    setPendingImageItems([]);
    setSelectedPendingImageId(null);
    setScreenshotStatus("импорт изображений отменен");
    setScreenshotDateInsight(null);
  }

  async function confirmPendingImageImport() {
    if (pendingImageItems.length === 0) {
      setScreenshotStatus("нечего сохранять");
      return;
    }

    try {
      setConfirmingPendingImageImport(true);
      setScreenshotStatus("сохраняем выбранное...");

      if (apiToken) {
        const savedItems: LibraryItem[] = [];
        for (const item of pendingImageItems) {
          const saved = await createItem(apiToken, item);
          savedItems.push(saved);
        }
        setLibrary((current) => [...savedItems, ...current]);
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
        setSelectedId(savedItems[0]?.id ?? null);
      } else {
        setLibrary((current) => [...pendingImageItems, ...current]);
        setSelectedId(pendingImageItems[0]?.id ?? null);
      }

      setScreenshotStatus(`добавили ${pendingImageItems.length} айтем(ов) из изображений`);
      const hasUndatedItems = pendingImageItems.some((item) => item.consumedAt == null);
      setPendingImageItems([]);
      setSelectedPendingImageId(null);
      setScreenshotDateInsight(null);
      setTab("library");
      setToastMessage(`добавили ${pendingImageItems.length} айтем(ов)`);
      timeline.setTimelinePromptVisible(hasUndatedItems);
      fireAnalytics("image_import_completed", {
        count: pendingImageItems.length,
        undatedCount: pendingImageItems.filter((item) => item.consumedAt == null).length,
      });
    } finally {
      setConfirmingPendingImageImport(false);
    }
  }

  async function importSpotifyLink() {
    const normalizedUrl = spotifyUrl.trim();
    if (!normalizedUrl) {
      setSpotifyStatus("вставь ссылку spotify или Яндекс.Музыки");
      return;
    }

    const isYandexMusic = /(^|\.)music\.yandex\.(ru|com)(\/|$)/i.test(normalizedUrl);
    const service = isYandexMusic ? "Яндекс.Музыки" : "spotify";

    try {
      setSpotifyStatus(`тянем данные из ${service}...`);
      setSpotifyDateInsight(null);
      const parsedItems = await importFromSpotifyUrl(normalizedUrl);

      if (parsedItems.length === 0) {
        setSpotifyStatus(`${service} ничего не вернул`);
        return;
      }

      const importedItems: LibraryItem[] = parsedItems.map((item) => ({
        id: uid(),
        type: item.type,
        source: isYandexMusic ? "import_yandex_music" : "import_spotify",
        title: item.title,
        authorOrArtist: item.authorOrArtist,
        createdAt: Date.now(),
        consumedAt: undefined,
        timeOrigin: undefined,
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
      const coverage = timeline.describeDateCoverage(importedItems);
      setSpotifyDateInsight(timeline.buildDateInsight(importedItems));
      setSpotifyStatus(
        `добавили ${importedItems.length} трек(ов) из ${service}${coverage ? ` · ${coverage}` : ""}`
      );
      setSpotifyUrl("");
      setTab("library");
      setToastMessage(`импортировали ${importedItems.length} трек(ов)`);
      timeline.setTimelinePromptVisible(true);
      fireAnalytics("music_link_import_completed", { count: importedItems.length, service: isYandexMusic ? "yandex_music" : "spotify" });
    } catch (error) {
      const message = error instanceof Error ? error.message : `не удалось импортировать из ${service}`;
      setSpotifyStatus(message);
      setToastMessage("импорт не удался");
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
        setToastMessage("spotify обновлен");
        fireAnalytics("spotify_connection_refreshed", { connected: true });
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
          ? `нашли ${data.playlists.length} плейлист(ов) spotify`
          : "плейлисты не нашлись"
      );
      fireAnalytics("spotify_playlists_loaded", { count: data.playlists.length });
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
      setSpotifyDateInsight(null);
      const result = await importFromSpotifyUser(apiToken, input);
      setImportedCount((current) => current + result.importedCount);

      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setSyncStatus("online");
      setSyncMessage("данные синхронизируются с сервером");
      setSpotifyDateInsight(
        timeline.buildDateInsight([
          ...Array.from({ length: result.dateCoverage?.exact ?? 0 }, () => ({ consumedAt: 1, timeOrigin: "exact" as const })),
          ...Array.from({ length: result.dateCoverage?.imported ?? 0 }, () => ({ consumedAt: 1, timeOrigin: "imported" as const })),
          ...Array.from({ length: result.dateCoverage?.undated ?? 0 }, () => ({ consumedAt: undefined, timeOrigin: undefined })),
        ])
      );
      if ((result.skippedCount ?? 0) > 0) {
        setSpotifyStatus(
          `добавили ${result.importedCount} трек(ов) из ${successLabel}, пропустили ${result.skippedCount} дублей${result.dateSummary ? ` · ${result.dateSummary}` : ""}`
        );
      } else {
        setSpotifyStatus(
          `добавили ${result.importedCount} трек(ов) из ${successLabel}${result.dateSummary ? ` · ${result.dateSummary}` : ""}`
        );
      }
      setTab("library");
      setToastMessage(`добавили ${result.importedCount} трек(ов)`);
      timeline.setTimelinePromptVisible(input.mode === "playlist");
      fireAnalytics("spotify_account_import_completed", {
        mode: input.mode,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount ?? 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось импортировать из spotify";
      setSpotifyStatus(message);
      setToastMessage("импорт не удался");
    }
  }

  async function disconnectSpotifySource(deleteContent = false) {
    if (!apiToken || spotifyOAuthLoading || spotifyPlaylistLoading) return;

    try {
      setSpotifyStatus(deleteContent ? "отвязываем spotify и убираем его импорт..." : "отвязываем spotify...");
      const result = await disconnectSpotifyConnection(apiToken, deleteContent);
      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setSpotifyConnected(false);
      setSpotifyProfileName(null);
      setSpotifyPlaylists([]);
      setSpotifyDateInsight(null);
      setSpotifyStatus(
        deleteContent
          ? `готово: spotify отвязали и убрали ${result.deletedItems} айтем(ов)`
          : "готово: spotify больше не подключен"
      );
      setToastMessage(deleteContent ? "spotify отвязали и почистили импорт" : "spotify отвязали");
      fireAnalytics("source_disconnected", { platform: "spotify", deleteContent, deletedItems: result.deletedItems });
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось отвязать spotify";
      setSpotifyStatus(message);
    }
  }

  async function importProfileSource(platform: ProfileSourcePlatform) {
    const config = PROFILE_SOURCES[platform];
    const input = platform === "lastfm" ? lastfmUsername : letterboxdProfile;
    const profile = clampText(input || connectedSources[platform]?.profile || "");
    if (!profile) {
      setFileImportStatus(config.emptyInput);
      return;
    }

    try {
      setFileImportStatus(config.lookingUp);
      setFileImportDateInsight(null);
      setFileImportStatus(config.fetching);
      const items = await config.fetchItems(profile);
      await persistImportedLibraryItems(
        items.map((item) => ({
          ...item,
          consumedAt: item.consumedAt ?? undefined,
          timeOrigin: item.timeOrigin ?? undefined,
        })),
        {
          successLabel: `добавили ${items.length} ${config.unit(items.length)} из ${config.label}`,
          successToast: `импортировали ${items.length} ${config.unit(items.length)}`,
          analyticsEvent: config.analyticsEvent,
          analyticsProperties: { profile },
          statusSetter: setFileImportStatus,
          dateInsightSetter: setFileImportDateInsight,
        }
      );
      await rememberConnectedSource(platform, profile);
      setFileImportStatus(
        items.length > 0
          ? `готово: нашли ${items.length} ${config.unit(items.length)} в ${config.label}`
          : "ничего не нашли в этом профиле"
      );
    } catch (error) {
      setFileImportStatus(error instanceof Error ? error.message : config.failed);
    }
  }

  async function rememberConnectedSource(platform: ProfileSourcePlatform, profile: string) {
    if (!apiToken) return;
    try {
      const result = await saveConnectedSource(apiToken, { platform, profile });
      setConnectedSources((current) => ({
        ...current,
        [platform]: { profile: result.source.profile, lastSyncedAt: result.source.lastSyncedAt },
      }));
      if (platform === "lastfm") setLastfmUsername(result.source.profile);
      else setLetterboxdProfile(result.source.profile);
    } catch {
      // импорт уже прошёл: не смогли запомнить источник — не повод показывать ошибку
    }
  }

  async function disconnectProfileSource(platform: "lastfm" | "letterboxd", deleteContent = false) {
    if (!apiToken || fileImportBusy) return;

    try {
      setFileImportBusy(true);
      setFileImportStatus(deleteContent ? "отвязываем источник и убираем его импорт..." : "отвязываем источник...");
      const result = await disconnectConnectedSource(apiToken, { platform, deleteContent });
      const remoteLibrary = await fetchItems(apiToken);
      setLibrary(remoteLibrary);
      setConnectedSources((current) => ({
        ...current,
        [platform]: null,
      }));
      if (platform === "lastfm") {
        setLastfmUsername("");
      } else {
        setLetterboxdProfile("");
      }
      setFileImportDateInsight(null);
      setFileImportStatus(
        deleteContent
          ? `готово: отвязали ${platform} и убрали ${result.deletedItems} айтем(ов)`
          : `готово: ${platform} больше не подключен`
      );
      setToastMessage(
        deleteContent
          ? `${platform} отвязали и почистили импорт`
          : `${platform} отвязали`
      );
      fireAnalytics("source_disconnected", { platform, deleteContent, deletedItems: result.deletedItems });
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось отвязать источник";
      setFileImportStatus(message);
    } finally {
      setFileImportBusy(false);
    }
  }

  return {
    isImporting, isScreenshotImporting, importedCount, screenshotStatus,
    pendingImageItems, selectedPendingImageId, confirmingPendingImageImport,
    spotifyUrl, spotifyStatus, spotifyConnected, spotifyProfileName, spotifyPlaylists,
    spotifyOAuthLoading, spotifyPlaylistLoading,
    lastfmUsername, letterboxdProfile, connectedSources,
    fileImportStatus, fileImportBusy, fileImportCanCancel,
    screenshotDateInsight, spotifyDateInsight, fileImportDateInsight,
    setImportedCount, setScreenshotStatus, setPendingImageItems, setSelectedPendingImageId,
    setSpotifyUrl, setSpotifyStatus, setSpotifyConnected, setSpotifyProfileName,
    setLastfmUsername, setLetterboxdProfile, setConnectedSources,
    setFileImportStatus, setFileImportDateInsight,
    persistImportedLibraryItems, runFakeImport, importPlatformFile, cancelFileImportOpening,
    importFromScreenshot, updatePendingImageItem, assignPendingImageItemTime,
    removePendingImageItem, cancelPendingImageImport, confirmPendingImageImport,
    importSpotifyLink, refreshSpotifyConnection, connectSpotifyAccount,
    loadSpotifyPlaylistsList, importSpotifyAccountSource, disconnectSpotifySource,
    importProfileSource, disconnectProfileSource,
  };
}
