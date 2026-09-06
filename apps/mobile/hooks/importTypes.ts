import type { LibraryItem } from "../shared/everyyou/domain";

export type SpotifyPlaylist = {
  id: string;
  name: string;
  trackCount: number;
};
export type PendingImageItem = Pick<
  LibraryItem,
  "id" | "type" | "source" | "title" | "authorOrArtist" | "createdAt" | "consumedAt" | "timeOrigin"
>;

export type ConnectedSourceState = {
  lastfm: { profile: string; lastSyncedAt: string | null } | null;
  letterboxd: { profile: string; lastSyncedAt: string | null } | null;
};
