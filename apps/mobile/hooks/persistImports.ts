import { Dispatch, SetStateAction } from "react";
import { createItem, fetchItems } from "../lib/api";
import { uid, type LibraryItem, type Tab } from "../shared/everyyou/domain";
import type { useTimeline } from "./useTimeline";
import type { SyncStatus } from "./appTypes";
import type { DateInsight } from "./timelineTypes";

export type ImportContext = {
  apiToken: string | null;
  setLibrary: Dispatch<SetStateAction<LibraryItem[]>>;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncMessage: (message: string) => void;
  setToastMessage: (message: string | null) => void;
  setTab: (tab: Tab) => void;
  timeline: ReturnType<typeof useTimeline>;
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
};

export type ImportedDraft = Pick<
  LibraryItem,
  "type" | "source" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin"
>;

export type PersistOptions = {
  successLabel: string;
  successToast: string;
  analyticsEvent: string;
  analyticsProperties?: Record<string, unknown>;
  statusSetter: (message: string | null) => void;
  dateInsightSetter: (value: DateInsight | null) => void;
};

async function pushToBackend(apiToken: string, items: ImportedDraft[], context: ImportContext) {
  for (const item of items) {
    await createItem(apiToken, item);
  }
  context.setLibrary(await fetchItems(apiToken));
  context.setSyncStatus("online");
  context.setSyncMessage("данные синхронизируются с сервером");
}

function pushToLocal(items: ImportedDraft[], context: ImportContext) {
  context.setLibrary((current) => [
    ...items.map((item) => ({ id: uid(), ...item, createdAt: Date.now() })),
    ...current,
  ]);
}

export async function persistImportedItems(
  items: ImportedDraft[],
  options: PersistOptions,
  context: ImportContext
) {
  if (items.length === 0) {
    options.statusSetter("ничего не нашли");
    return;
  }

  const { apiToken, timeline } = context;
  if (apiToken) await pushToBackend(apiToken, items, context);
  else pushToLocal(items, context);

  const coverage = timeline.describeDateCoverage(items);
  options.dateInsightSetter(timeline.buildDateInsight(items));
  options.statusSetter(`${options.successLabel}${coverage ? ` · ${coverage}` : ""}`);
  context.setToastMessage(options.successToast);
  context.fireAnalytics(options.analyticsEvent, {
    count: items.length,
    ...(apiToken ? {} : { mode: "local" }),
    ...(options.analyticsProperties ?? {}),
  });

  context.setTab("library");
  timeline.setTimelinePromptVisible(items.some((item) => item.consumedAt == null));
}
