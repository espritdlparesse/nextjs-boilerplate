import { useState } from "react";
import { getConsumptionDate, type LibraryItem, type TimeOrigin, type Tab } from "../shared/everyyou/domain";
import { updateItem } from "../lib/api";
import { Dispatch, SetStateAction } from "react";
import type { DateInsight, TimelineSpreadPreset } from "./timelineTypes";

type SyncStatus = "idle" | "syncing" | "online" | "offline";

export function useTimeline(deps: {
  apiToken: string | null;
  library: LibraryItem[];
  setLibrary: Dispatch<SetStateAction<LibraryItem[]>>;
  setSyncStatus: (status: SyncStatus) => void;
  setSyncMessage: (message: string) => void;
  setToastMessage: (message: string | null) => void;
  setTab: (tab: Tab) => void;
  undatedVisibleLibrary: LibraryItem[];
}) {
  const { apiToken, library, setLibrary, setSyncStatus, setSyncMessage, setToastMessage, setTab, undatedVisibleLibrary } = deps;
  const [timelineSpreading, setTimelineSpreading] = useState(false);
  const [timelinePromptVisible, setTimelinePromptVisible] = useState(false);

  function describeDateCoverage(items: Array<Pick<LibraryItem, "consumedAt" | "timeOrigin">>) {
    const exact = items.filter((item) => item.timeOrigin === "exact").length;
    const imported = items.filter((item) => item.timeOrigin === "imported").length;
    const estimated = items.filter((item) => item.timeOrigin === "estimated").length;
    const undated = items.filter((item) => item.consumedAt == null).length;
    const parts: string[] = [];
    if (exact > 0) parts.push(`точные даты: ${exact}`);
    if (imported > 0) parts.push(`из импорта: ${imported}`);
    if (estimated > 0) parts.push(`примерно: ${estimated}`);
    if (undated > 0) parts.push(`без даты: ${undated}`);
    return parts.join(" · ");
  }

  function buildDateInsight(items: Array<Pick<LibraryItem, "consumedAt" | "timeOrigin">>): DateInsight | null {
    const exact = items.filter((item) => item.timeOrigin === "exact" && item.consumedAt != null).length;
    const imported = items.filter((item) => item.timeOrigin === "imported" && item.consumedAt != null).length;
    const estimated = items.filter((item) => item.timeOrigin === "estimated" && item.consumedAt != null).length;
    const dated = exact + imported;
    const undated = items.filter((item) => item.consumedAt == null).length;

    if (dated === 0 && estimated === 0 && undated === 0) return null;

    if (dated > 0 && undated > 0) {
      return {
        title: `нашли реальные даты у ${dated} айтем(ов)`,
        body: "остальное нужно разложить вручную",
        meta: [exact > 0 ? `точные: ${exact}` : null, imported > 0 ? `из импорта: ${imported}` : null]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (dated > 0 && undated === 0) {
      return {
        title: "у найденного контента уже есть даты",
        body: "можно сразу смотреть его в календаре",
        meta: [exact > 0 ? `точные: ${exact}` : null, imported > 0 ? `из импорта: ${imported}` : null]
          .filter(Boolean)
          .join(" · "),
      };
    }

    if (estimated > 0 && undated === 0) {
      return {
        title: "время уже разложено примерно",
        body: "если захочешь, потом можно поправить отдельные карточки",
        meta: `примерно: ${estimated}`,
      };
    }

    return {
      title: "у этого импорта нет реальных дат",
      body: "после сохранения можно разложить контент вручную",
      meta: undated > 0 ? `без даты: ${undated}` : undefined,
    };
  }

  function buildSpreadDates(count: number, preset: TimelineSpreadPreset) {
    const now = new Date();
    const monthAnchors: Date[] = [];

    if (preset === "this_month") {
      monthAnchors.push(new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0));
    } else if (preset === "last_month") {
      monthAnchors.push(new Date(now.getFullYear(), now.getMonth() - 1, 1, 12, 0, 0, 0));
    } else if (preset === "last_6_months") {
      for (let offset = 0; offset < 6; offset += 1) {
        monthAnchors.push(new Date(now.getFullYear(), now.getMonth() - offset, 1, 12, 0, 0, 0));
      }
    } else if (preset === "very_old") {
      for (let yearOffset = 2; yearOffset <= 5; yearOffset += 1) {
        monthAnchors.push(new Date(now.getFullYear() - yearOffset, now.getMonth(), 1, 12, 0, 0, 0));
      }
    } else {
      for (let month = now.getMonth(); month >= 0; month -= 1) {
        monthAnchors.push(new Date(now.getFullYear(), month, 1, 12, 0, 0, 0));
      }
    }

    const dates: number[] = [];
    for (let index = 0; index < count; index += 1) {
      const anchor = monthAnchors[index % monthAnchors.length];
      const day = 1 + (index % 24);
      const hour = 11 + (index % 8);
      dates.push(new Date(anchor.getFullYear(), anchor.getMonth(), day, hour, 0, 0, 0).getTime());
    }

    return dates.sort((a, b) => b - a);
  }

  async function pushConsumedDates(targets: LibraryItem[], dates: number[], timeOrigin: TimeOrigin) {
    if (!apiToken) return;
    const updatedItems: LibraryItem[] = [];
    for (const [index, item] of targets.entries()) {
      updatedItems.push(await updateItem(apiToken, {
        id: item.id,
        type: item.type,
        source: item.source,
        title: item.title,
        authorOrArtist: item.authorOrArtist,
        consumedAt: dates[index],
        timeOrigin,
      }));
    }
    setLibrary((current) =>
      current.map((item) => updatedItems.find((updated) => updated.id === item.id) ?? item)
    );
  }

  async function spreadVisibleUndatedItems(preset: TimelineSpreadPreset) {
    const items = undatedVisibleLibrary;
    if (items.length === 0 || timelineSpreading) return;

    const dates = buildSpreadDates(items.length, preset);
    setTimelineSpreading(true);

    try {
      if (apiToken) {
        await pushConsumedDates(items, dates, "estimated");
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) =>
          current.map((item) => {
            const index = items.findIndex((candidate) => candidate.id === item.id);
            if (index === -1) return item;
            return { ...item, consumedAt: dates[index], timeOrigin: "estimated" };
          })
        );
      }

      setToastMessage(`разложили ${items.length} по времени`);
      setTimelinePromptVisible(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось разложить по времени";
      setSyncStatus("offline");
      setSyncMessage(message);
      setToastMessage("не удалось разложить");
    } finally {
      setTimelineSpreading(false);
    }
  }

  async function assignTimelineToItem(itemId: string, preset: TimelineSpreadPreset) {
    const item = library.find((entry) => entry.id === itemId);
    if (!item || timelineSpreading) return;

    const [date] = buildSpreadDates(1, preset);
    setTimelineSpreading(true);

    try {
      if (apiToken) {
        const updated = await updateItem(apiToken, {
          id: item.id,
          type: item.type,
          source: item.source,
          title: item.title,
          authorOrArtist: item.authorOrArtist,
          consumedAt: date,
          timeOrigin: "estimated",
        });
        setLibrary((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, consumedAt: date, timeOrigin: "estimated" } : entry
          )
        );
      }

      setToastMessage("время обновили");
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось обновить время";
      setSyncStatus("offline");
      setSyncMessage(message);
      setToastMessage("не удалось обновить время");
    } finally {
      setTimelineSpreading(false);
    }
  }

  async function moveItemsToDate(itemIds: string[], targetDate: number) {
    const selectedItems = library.filter((item) => itemIds.includes(item.id));
    if (selectedItems.length === 0 || timelineSpreading) return;

    setTimelineSpreading(true);

    const movedAt = selectedItems.map((item, index) => {
      const original = getConsumptionDate(item);
      const base = new Date(targetDate);
      const sourceTime = original ? new Date(original) : null;
      const hours = sourceTime ? sourceTime.getHours() : 12;
      const minutes = sourceTime ? sourceTime.getMinutes() : Math.min(index * 3, 57);
      return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0).getTime();
    });

    try {
      if (apiToken) {
        await pushConsumedDates(selectedItems, movedAt, "exact");
        setSyncStatus("online");
        setSyncMessage("данные синхронизируются с сервером");
      } else {
        setLibrary((current) =>
          current.map((item) => {
            const index = selectedItems.findIndex((candidate) => candidate.id === item.id);
            if (index === -1) return item;
            return { ...item, consumedAt: movedAt[index], timeOrigin: "exact" };
          })
        );
      }

      setToastMessage(selectedItems.length === 1 ? "дату перенесли" : `перенесли ${selectedItems.length} айтема`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "не удалось перенести дату";
      setSyncStatus("offline");
      setSyncMessage(message);
      setToastMessage("не удалось перенести");
    } finally {
      setTimelineSpreading(false);
    }
  }

  function promptTimelinePlacement() {
    if (undatedVisibleLibrary.length === 0) return;
    setTimelinePromptVisible(true);
    setTab("library");
  }

  return {
    timelineSpreading, timelinePromptVisible, setTimelinePromptVisible,
    describeDateCoverage, buildDateInsight, buildSpreadDates, pushConsumedDates,
    spreadVisibleUndatedItems, assignTimelineToItem, moveItemsToDate, promptTimelinePlacement,
  };
}
