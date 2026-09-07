import type { ContentType, SourceType, TimeOrigin } from "../shared/everyyou/domain";

export type TypeFilter = ContentType | "all";
export type SourceFilter = SourceType | "all";
export type TimeQualityFilter = "all" | TimeOrigin | "undated";
export type SyncStatus = "idle" | "syncing" | "online" | "offline";

export type TelegramLinkState = {
  linked: boolean;
  telegramOwnerKey: string | null;
  code: string | null;
  expiresAt: string | null;
};
