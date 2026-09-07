import { useDeferredValue, useMemo, useState } from "react";
import type { ContentType, LibraryItem } from "../shared/everyyou/domain";
import type { SourceFilter, TimeQualityFilter, TypeFilter } from "./appTypes";

function matchesTime(item: LibraryItem, filter: TimeQualityFilter) {
  if (filter === "all") return true;
  if (filter === "undated") return item.consumedAt == null;
  return item.timeOrigin === filter;
}

export function useLibraryView(library: LibraryItem[], selectedId: string | null) {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [timeQualityFilter, setTimeQualityFilter] = useState<TimeQualityFilter>("all");
  const deferredLibrary = useDeferredValue(library);

  const selectedItem = useMemo(
    () => (selectedId ? library.find((item) => item.id === selectedId) ?? null : null),
    [library, selectedId]
  );
  const visibleLibrary = useMemo(
    () =>
      deferredLibrary.filter(
        (item) =>
          (typeFilter === "all" || item.type === typeFilter) &&
          (sourceFilter === "all" || item.source === sourceFilter) &&
          matchesTime(item, timeQualityFilter)
      ),
    [deferredLibrary, sourceFilter, timeQualityFilter, typeFilter]
  );
  const counters = useMemo(() => {
    const byType: Record<ContentType, number> = { music: 0, book: 0, movie: 0 };
    library.forEach((item) => {
      byType[item.type] += 1;
    });
    return { byType, total: library.length };
  }, [library]);
  const timeStats = useMemo(
    () => ({
      exact: library.filter((item) => item.timeOrigin === "exact").length,
      imported: library.filter((item) => item.timeOrigin === "imported").length,
      estimated: library.filter((item) => item.timeOrigin === "estimated").length,
      undated: library.filter((item) => item.consumedAt == null).length,
    }),
    [library]
  );
  const undatedVisibleLibrary = useMemo(
    () => visibleLibrary.filter((item) => item.source !== "manual" && item.consumedAt == null),
    [visibleLibrary]
  );

  return {
    typeFilter, sourceFilter, timeQualityFilter,
    setTypeFilter, setSourceFilter, setTimeQualityFilter,
    selectedItem, visibleLibrary, counters, timeStats, undatedVisibleLibrary,
  };
}
