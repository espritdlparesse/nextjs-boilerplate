import type { useItemEditor } from "./useItemEditor";
import type { useLibraryImports } from "./useLibraryImports";
import type { useLibraryView } from "./useLibraryView";
import type { useTimeline } from "./useTimeline";
import type { SourceFilter, TimeQualityFilter, TypeFilter } from "./appTypes";
import type { TimelineSpreadPreset } from "./timelineTypes";
import type { Tab } from "../shared/everyyou/domain";

export function spotifyApi(imports: ReturnType<typeof useLibraryImports>) {
  return {
    refreshSpotifyConnection: () => imports.refreshSpotifyConnection(true),
    loadSpotifyPlaylists: imports.loadSpotifyPlaylistsList,
    importSpotifyLikedSongs: () => imports.importSpotifyAccountSource({ mode: "liked" }, "liked songs"),
    importSpotifyRecentlyPlayed: () =>
      imports.importSpotifyAccountSource({ mode: "recently_played" }, "recently played"),
    importSpotifyPlaylist: (playlistId: string, playlistName: string) =>
      imports.importSpotifyAccountSource({ mode: "playlist", playlistId }, `playlist ${playlistName}`),
  };
}

export function timelineApi(timeline: ReturnType<typeof useTimeline>, selectedId: string | null) {
  return {
    spreadTimeline: timeline.spreadVisibleUndatedItems,
    assignItemTime: timeline.assignTimelineToItem,
    assignSelectedTime: (preset: TimelineSpreadPreset) =>
      selectedId && timeline.assignTimelineToItem(selectedId, preset),
    moveItemsToDate: timeline.moveItemsToDate,
    dismissTimelinePrompt: () => timeline.setTimelinePromptVisible(false),
  };
}

export function filterApi(
  view: ReturnType<typeof useLibraryView>,
  editor: ReturnType<typeof useItemEditor>,
  setTab: (tab: Tab) => void,
  setSelectedId: (id: string | null) => void
) {
  function clearSelection<Value>(apply: (value: Value) => void) {
    return (value: Value) => {
      apply(value);
      setSelectedId(null);
    };
  }

  return {
    cancelEdit: () => {
      editor.setEditingId(null);
      editor.resetForm();
      setTab("library");
    },
    setTypeFilter: clearSelection<TypeFilter>(view.setTypeFilter),
    setSourceFilter: clearSelection<SourceFilter>(view.setSourceFilter),
    setTimeQualityFilter: clearSelection<TimeQualityFilter>(view.setTimeQualityFilter),
  };
}
