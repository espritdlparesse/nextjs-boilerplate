import type { Tab, VibeDuel, VibeDuelVariant, ItemType, ItemSource, ImportedItem, DbItem, ImportPlatform, ImportService } from "@/app/types";
import { apiFetch, getTgInitData, safeJson } from "@/app/apiFetch";
import { useEffect, useMemo, useRef, useState } from "react";
import { generateMonthlySummary } from "@/lib/monthlySummaryEngine";
import { dayKey, addDays, startOfMonth, getItemDateValue, calendarGrid } from "@/lib/dates";

export function useLibrary(deps: {
  items: DbItem[];
  loadLibrary: () => void;
  setLibraryError: (message: string) => void;
  setLibraryLoading: (loading: boolean) => void;
}) {
  const { items, loadLibrary, setLibraryError, setLibraryLoading } = deps;
  const [libFilter, setLibFilter] = useState<ItemType | "all" | string>("all");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [selectedDayTypeFilter, setSelectedDayTypeFilter] = useState<ItemType | "all">("all");
  const [selectedDayItems, setSelectedDayItems] = useState<Array<string | number>>([]);
  const [calendarMoveMode, setCalendarMoveMode] = useState(false);
  const [pendingMoveTargetKey, setPendingMoveTargetKey] = useState<string | null>(null);
  const [moveOriginDayKey, setMoveOriginDayKey] = useState<string | null>(null);
  const [returnDayKey, setReturnDayKey] = useState<string | null>(null);
  const [lastMovedTargetKey, setLastMovedTargetKey] = useState<string | null>(dayKey(new Date()));
  const [libraryStatus, setLibraryStatus] = useState("");
  const filteredItems = useMemo(() => {
    if (libFilter === "all") return items;
    if (libFilter === "music" || libFilter === "book" || libFilter === "movie") return items.filter(i => i.type === libFilter);
    // кастомная категория по id
    return items.filter(i => i.custom_category_id === libFilter);
  }, [items, libFilter]);

  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, DbItem[]>();
    for (const item of filteredItems) {
      const dateValue = getItemDateValue(item);
      if (!dateValue) continue;
      const key = dayKey(dateValue);
      if (!key) continue;
      const bucket = grouped.get(key) ?? [];
      bucket.push(item);
      grouped.set(key, bucket);
    }
    return grouped;
  }, [filteredItems]);

  const calendarDays = useMemo(
    () => calendarGrid(calendarMonth).map((day) => ({ ...day, items: itemsByDay.get(day.key) ?? [] })),
    [calendarMonth, itemsByDay]
  );

  const selectedDay = useMemo(() => {
    if (selectedDayKey) return calendarDays.find((entry) => entry.key === selectedDayKey) ?? null;
    const todayKey = dayKey(new Date());
    return calendarDays.find((entry) => entry.key === todayKey && entry.inMonth) ?? null;
  }, [calendarDays, selectedDayKey]);

  const monthlySummary = useMemo(() => {
    const currentMonthItems = calendarDays.filter((day) => day.inMonth).flatMap((day) => day.items);
    const previousMonthStart = startOfMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
    const previousMonthItems: DbItem[] = [];
    for (const [key, dayItems] of itemsByDay.entries()) {
      const date = new Date(`${key}T00:00:00`);
      if (date.getFullYear() === previousMonthStart.getFullYear() && date.getMonth() === previousMonthStart.getMonth()) {
        previousMonthItems.push(...dayItems);
      }
    }
    return generateMonthlySummary(currentMonthItems, previousMonthItems);
  }, [calendarDays, calendarMonth, itemsByDay]);

  const selectedDayVisibleItems = useMemo(() => {
    if (!selectedDay) return [];
    const dayItems = itemsByDay.get(selectedDay.key) ?? [];
    if (selectedDayTypeFilter === "all") return dayItems;
    return dayItems.filter((item) => item.type === selectedDayTypeFilter);
  }, [itemsByDay, selectedDay, selectedDayTypeFilter]);

  const selectedDayCounts = useMemo(() => {
    const dayItems = selectedDay ? itemsByDay.get(selectedDay.key) ?? [] : [];
    return {
      all: dayItems.length,
      music: dayItems.filter((item) => item.type === "music").length,
      book: dayItems.filter((item) => item.type === "book").length,
      movie: dayItems.filter((item) => item.type === "movie").length,
    };
  }, [itemsByDay, selectedDay]);

  const pendingMoveTarget = useMemo(
    () => (pendingMoveTargetKey ? calendarDays.find((entry) => entry.key === pendingMoveTargetKey) ?? null : null),
    [calendarDays, pendingMoveTargetKey]
  );

  const returnDay = useMemo(
    () => (returnDayKey ? calendarDays.find((entry) => entry.key === returnDayKey) ?? null : null),
    [calendarDays, returnDayKey]
  );
  const lastMovedTargetDay = useMemo(
    () => (lastMovedTargetKey ? calendarDays.find((entry) => entry.key === lastMovedTargetKey) ?? null : null),
    [calendarDays, lastMovedTargetKey]
  );

  function toggleSelectedDayItem(id: string | number) {
    setSelectedDayItems((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function startMoveSelectedDayItems() {
    if (selectedDayItems.length === 0) return;
    setMoveOriginDayKey(selectedDay?.key ?? null);
    setReturnDayKey(null);
    setDayModalOpen(false);
    setPendingMoveTargetKey(null);
    setCalendarMoveMode(true);
    setLibraryStatus("выбери день, на который перенести выбранное");
  }

  function cancelMoveSelectedDayItems() {
    setCalendarMoveMode(false);
    setPendingMoveTargetKey(null);
    setSelectedDayItems([]);
    setMoveOriginDayKey(null);
    setLibraryStatus("");
  }

  async function moveSelectedItemsToDay() {
    if (!pendingMoveTarget || selectedDayItems.length === 0) return;

    const chosenItems = items.filter((item) => selectedDayItems.includes(item.id));
    if (chosenItems.length === 0) return;

    setLibraryLoading(true);
    setLibraryError("");
    try {
      for (const [index, item] of chosenItems.entries()) {
        const base = pendingMoveTarget.date;
        const sourceDate = getItemDateValue(item) ? new Date(getItemDateValue(item)) : null;
        const hours = sourceDate ? sourceDate.getHours() : 12;
        const minutes = sourceDate ? sourceDate.getMinutes() : Math.min(index * 3, 57);
        const targetDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hours, minutes, 0, 0).getTime();

        const { res, json } = await apiFetch("/api/items", { method: "PATCH", body: JSON.stringify({ id: item.id, type: item.type, source: item.source, title: item.title, creator: item.creator ?? null, consumedAt: targetDate, timeOrigin: "exact", }),
        });
        if (!res.ok) throw new Error(json?.error ?? "не удалось перенести дату");
      }

      await loadLibrary();
      setLibraryStatus(
        chosenItems.length === 1
          ? `да, все ок: перенесли на ${pendingMoveTarget.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`
          : `да, все ок: перенесли ${chosenItems.length} на ${pendingMoveTarget.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`
      );
      setReturnDayKey(moveOriginDayKey);
      setLastMovedTargetKey(pendingMoveTarget.key);
      setCalendarMoveMode(false);
      setPendingMoveTargetKey(null);
      setSelectedDayItems([]);
      setMoveOriginDayKey(null);
      setSelectedDayKey(pendingMoveTarget.key);
      setDayModalOpen(true);
    } catch (e: any) {
      setLibraryError(e?.message ?? "не удалось перенести дату");
    } finally {
      setLibraryLoading(false);
    }
  }

  function jumpBackToReturnDay() {
    if (!returnDay) return;
    setCalendarMonth(startOfMonth(returnDay.date));
    setSelectedDayKey(returnDay.key);
    setSelectedDayTypeFilter("all");
    setSelectedDayItems([]);
    setPendingMoveTargetKey(null);
    setCalendarMoveMode(false);
    setDayModalOpen(true);
    setReturnDayKey(null);
    setLibraryStatus("");
  }

  return {
    libFilter, libraryStatus, calendarMonth, selectedDayKey, dayModalOpen,
    selectedDayTypeFilter, selectedDayItems, calendarMoveMode, pendingMoveTargetKey,
    moveOriginDayKey, returnDayKey, lastMovedTargetKey,
    filteredItems, itemsByDay, calendarDays, selectedDay, monthlySummary,
    selectedDayVisibleItems, selectedDayCounts, pendingMoveTarget, returnDay, lastMovedTargetDay,
    setLibFilter, setLibraryStatus, setCalendarMonth, setSelectedDayKey, setDayModalOpen,
    setSelectedDayTypeFilter, setSelectedDayItems, setCalendarMoveMode,
    setPendingMoveTargetKey, setMoveOriginDayKey, setReturnDayKey, setLastMovedTargetKey,
    toggleSelectedDayItem, startMoveSelectedDayItems, cancelMoveSelectedDayItems,
    moveSelectedItemsToDay, jumpBackToReturnDay,
  };
}
