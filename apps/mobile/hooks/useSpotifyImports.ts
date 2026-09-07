import { Dispatch, SetStateAction, useEffect, useState } from "react";
import { Linking } from "react-native";
import {
  createItem,
  disconnectSpotifyConnection,
  fetchItems,
  fetchSpotifyConnectionStatus,
  fetchSpotifyPlaylists,
  getSpotifyOAuthUrl,
  importFromSpotifyUrl,
  importFromSpotifyUser,
} from "../lib/api";
import { uid, type LibraryItem } from "../shared/everyyou/domain";
import type { DateInsight } from "./timelineTypes";
import type { SpotifyPlaylist } from "./importTypes";
import type { ImportContext } from "./persistImports";

type SpotifyIo = ImportContext & {
  setImportedCount: Dispatch<SetStateAction<number>>;
  setSpotifyUrl: (value: string) => void;
  setSpotifyStatus: (value: string | null) => void;
  setSpotifyConnected: (value: boolean) => void;
  setSpotifyProfileName: (value: string | null) => void;
  setSpotifyPlaylists: (value: SpotifyPlaylist[]) => void;
  setSpotifyDateInsight: (value: DateInsight | null) => void;
};

async function importSpotifyLink(spotifyUrl: string, io: SpotifyIo) {
  const normalizedUrl = spotifyUrl.trim();
  if (!normalizedUrl) {
    io.setSpotifyStatus("вставь ссылку spotify или Яндекс.Музыки");
    return;
  }

  const isYandexMusic = /(^|\.)music\.yandex\.(ru|com)(\/|$)/i.test(normalizedUrl);
  const service = isYandexMusic ? "Яндекс.Музыки" : "spotify";

  try {
    io.setSpotifyStatus(`тянем данные из ${service}...`);
    io.setSpotifyDateInsight(null);
    const parsedItems = await importFromSpotifyUrl(normalizedUrl);

    if (parsedItems.length === 0) {
      io.setSpotifyStatus(`${service} ничего не вернул`);
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

    if (io.apiToken) {
      const savedItems: LibraryItem[] = [];
      for (const item of importedItems) {
        const saved = await createItem(io.apiToken, item);
        savedItems.push(saved);
      }
      io.setLibrary((current) => [...savedItems, ...current]);
      io.setSyncStatus("online");
      io.setSyncMessage("данные синхронизируются с сервером");
    } else {
      io.setLibrary((current) => [...importedItems, ...current]);
    }

    io.setImportedCount((current) => current + importedItems.length);
    const coverage = io.timeline.describeDateCoverage(importedItems);
    io.setSpotifyDateInsight(io.timeline.buildDateInsight(importedItems));
    io.setSpotifyStatus(
      `добавили ${importedItems.length} трек(ов) из ${service}${coverage ? ` · ${coverage}` : ""}`
    );
    io.setSpotifyUrl("");
    io.setTab("library");
    io.setToastMessage(`импортировали ${importedItems.length} трек(ов)`);
    io.timeline.setTimelinePromptVisible(true);
    io.fireAnalytics("music_link_import_completed", { count: importedItems.length, service: isYandexMusic ? "yandex_music" : "spotify" });
  } catch (error) {
    const message = error instanceof Error ? error.message : `не удалось импортировать из ${service}`;
    io.setSpotifyStatus(message);
    io.setToastMessage("импорт не удался");
  }
}

async function refreshSpotifyConnection(io: SpotifyIo, showSuccessMessage = false) {
  if (!io.apiToken) {
    io.setSpotifyStatus("backend token missing");
    return false;
  }

  try {
    const status = await fetchSpotifyConnectionStatus(io.apiToken);
    io.setSpotifyConnected(status.connected);
    io.setSpotifyProfileName(status.profile?.displayName ?? null);
    if (!status.connected) {
      io.setSpotifyStatus("spotify пока не подключен");
      return false;
    }
    if (showSuccessMessage) {
      io.setSpotifyStatus(
        status.profile?.displayName
          ? `spotify подключен: ${status.profile.displayName}`
          : "spotify подключен"
      );
      io.setToastMessage("spotify обновлен");
      io.fireAnalytics("spotify_connection_refreshed", { connected: true });
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "не удалось проверить spotify";
    io.setSpotifyStatus(message);
    return false;
  }
}

async function connectSpotifyAccount(io: SpotifyIo) {
  if (!io.apiToken) return;

  try {
    io.setSpotifyStatus("открываем spotify login...");
    const { authUrl } = await getSpotifyOAuthUrl(io.apiToken);
    const canOpen = await Linking.canOpenURL(authUrl);
    if (!canOpen) {
      throw new Error("не удалось открыть spotify login");
    }
    await Linking.openURL(authUrl);
    io.setSpotifyStatus("заверши логин в браузере, потом вернись и нажми обновить spotify");
  } catch (error) {
    const message = error instanceof Error ? error.message : "spotify oauth failed";
    io.setSpotifyStatus(message);
  }
}

async function loadSpotifyPlaylistsList(spotifyConnected: boolean, io: SpotifyIo) {
  if (!io.apiToken) return;

  try {
    const statusOk = spotifyConnected ? true : await refreshSpotifyConnection(io);
    if (!statusOk) return;
    io.setSpotifyStatus("грузим плейлисты...");
    const data = await fetchSpotifyPlaylists(io.apiToken);
    io.setSpotifyPlaylists(data.playlists);
    io.setSpotifyStatus(
      data.playlists.length > 0
        ? `нашли ${data.playlists.length} плейлист(ов) spotify`
        : "плейлисты не нашлись"
    );
    io.fireAnalytics("spotify_playlists_loaded", { count: data.playlists.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "не удалось загрузить плейлисты";
    io.setSpotifyStatus(message);
  }
}

async function importSpotifyAccountSource(
  input: { mode: "liked" | "recently_played" | "playlist"; playlistId?: string },
  successLabel: string,
  spotifyConnected: boolean,
  io: SpotifyIo
) {
  if (!io.apiToken) {
    io.setSpotifyStatus("backend token missing");
    return;
  }

  try {
    const statusOk = spotifyConnected ? true : await refreshSpotifyConnection(io);
    if (!statusOk) return;

    io.setSpotifyStatus(`тянем ${successLabel} из spotify...`);
    io.setSpotifyDateInsight(null);
    const result = await importFromSpotifyUser(io.apiToken, input);
    io.setImportedCount((current) => current + result.importedCount);

    const remoteLibrary = await fetchItems(io.apiToken);
    io.setLibrary(remoteLibrary);
    io.setSyncStatus("online");
    io.setSyncMessage("данные синхронизируются с сервером");
    io.setSpotifyDateInsight(
      io.timeline.buildDateInsight([
        ...Array.from({ length: result.dateCoverage?.exact ?? 0 }, () => ({ consumedAt: 1, timeOrigin: "exact" as const })),
        ...Array.from({ length: result.dateCoverage?.imported ?? 0 }, () => ({ consumedAt: 1, timeOrigin: "imported" as const })),
        ...Array.from({ length: result.dateCoverage?.undated ?? 0 }, () => ({ consumedAt: undefined, timeOrigin: undefined })),
      ])
    );
    if ((result.skippedCount ?? 0) > 0) {
      io.setSpotifyStatus(
        `добавили ${result.importedCount} трек(ов) из ${successLabel}, пропустили ${result.skippedCount} дублей${result.dateSummary ? ` · ${result.dateSummary}` : ""}`
      );
    } else {
      io.setSpotifyStatus(
        `добавили ${result.importedCount} трек(ов) из ${successLabel}${result.dateSummary ? ` · ${result.dateSummary}` : ""}`
      );
    }
    io.setTab("library");
    io.setToastMessage(`добавили ${result.importedCount} трек(ов)`);
    io.timeline.setTimelinePromptVisible(input.mode === "playlist");
    io.fireAnalytics("spotify_account_import_completed", {
      mode: input.mode,
      importedCount: result.importedCount,
      skippedCount: result.skippedCount ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "не удалось импортировать из spotify";
    io.setSpotifyStatus(message);
    io.setToastMessage("импорт не удался");
  }
}

async function disconnectSpotifySource(io: SpotifyIo, deleteContent = false) {
  if (!io.apiToken) return;

  try {
    io.setSpotifyStatus(deleteContent ? "отвязываем spotify и убираем его импорт..." : "отвязываем spotify...");
    const result = await disconnectSpotifyConnection(io.apiToken, deleteContent);
    const remoteLibrary = await fetchItems(io.apiToken);
    io.setLibrary(remoteLibrary);
    io.setSpotifyConnected(false);
    io.setSpotifyProfileName(null);
    io.setSpotifyPlaylists([]);
    io.setSpotifyDateInsight(null);
    io.setSpotifyStatus(
      deleteContent
        ? `готово: spotify отвязали и убрали ${result.deletedItems} айтем(ов)`
        : "готово: spotify больше не подключен"
    );
    io.setToastMessage(deleteContent ? "spotify отвязали и почистили импорт" : "spotify отвязали");
    io.fireAnalytics("source_disconnected", { platform: "spotify", deleteContent, deletedItems: result.deletedItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : "не удалось отвязать spotify";
    io.setSpotifyStatus(message);
  }
}

async function refreshSpotifyStatus(token: string, io: SpotifyIo) {
  try {
    const status = await fetchSpotifyConnectionStatus(token);
    io.setSpotifyConnected(status.connected);
    io.setSpotifyProfileName(status.profile?.displayName ?? null);
  } catch {
    io.setSpotifyConnected(false);
    io.setSpotifyProfileName(null);
  }
}


export function useSpotifyImports(context: ImportContext, setImportedCount: Dispatch<SetStateAction<number>>) {
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyStatus, setSpotifyStatus] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyProfileName, setSpotifyProfileName] = useState<string | null>(null);
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [spotifyOAuthLoading, setSpotifyOAuthLoading] = useState(false);
  const [spotifyPlaylistLoading, setSpotifyPlaylistLoading] = useState(false);
  const [spotifyDateInsight, setSpotifyDateInsight] = useState<DateInsight | null>(null);


  const io: SpotifyIo = {
    ...context,
    setImportedCount,
    setSpotifyUrl,
    setSpotifyStatus,
    setSpotifyConnected,
    setSpotifyProfileName,
    setSpotifyPlaylists,
    setSpotifyDateInsight,
  };

  useEffect(() => {
    if (context.apiToken) void refreshSpotifyStatus(context.apiToken, io);
  }, [context.apiToken]);

  return {
    spotifyUrl, spotifyStatus, spotifyConnected, spotifyProfileName, spotifyPlaylists,
    spotifyOAuthLoading, spotifyPlaylistLoading, spotifyDateInsight,
    setSpotifyUrl, setSpotifyStatus, setSpotifyConnected, setSpotifyProfileName,
    refreshSpotifyStatus: (token: string) => refreshSpotifyStatus(token, io),
    importSpotifyLink: () => importSpotifyLink(spotifyUrl, io),
    refreshSpotifyConnection: (showSuccessMessage = false) => refreshSpotifyConnection(io, showSuccessMessage),
    connectSpotifyAccount: async () => {
      if (spotifyOAuthLoading) return;
      setSpotifyOAuthLoading(true);
      try {
        await connectSpotifyAccount(io);
      } finally {
        setSpotifyOAuthLoading(false);
      }
    },
    loadSpotifyPlaylistsList: async () => {
      if (spotifyPlaylistLoading) return;
      setSpotifyPlaylistLoading(true);
      try {
        await loadSpotifyPlaylistsList(spotifyConnected, io);
      } finally {
        setSpotifyPlaylistLoading(false);
      }
    },
    importSpotifyAccountSource: (
      input: { mode: "liked" | "recently_played" | "playlist"; playlistId?: string },
      successLabel: string
    ) => importSpotifyAccountSource(input, successLabel, spotifyConnected, io),
    disconnectSpotifySource: (deleteContent = false) => disconnectSpotifySource(io, deleteContent),
  };
}
