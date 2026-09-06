import { memo, useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  formatFullDate,
  getConsumptionDate,
  getTimeOriginLabel,
  TYPE_LABEL,
  type ContentType,
  type LibraryItem,
  type SourceType,
  type ThemeMode,
} from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type TypeFilter = ContentType | "all";
type SourceFilter = SourceType | "all";
type LibraryViewMode = "tiles" | "calendar";

function reactItemKey(item: LibraryItem, index: number) {
  return `${item.id}-${item.consumedAt ?? item.createdAt ?? "nodate"}-${index}`;
}

type LibraryScreenProps = {
  themeMode: ThemeMode;
  typeFilter: TypeFilter;
  sourceFilter: SourceFilter;
  timeQualityFilter: "all" | "exact" | "imported" | "estimated" | "undated";
  undatedVisibleLibrary: LibraryItem[];
  timelineSpreading: boolean;
  timelinePromptVisible: boolean;
  selectedItem: LibraryItem | null;
  visibleLibrary: LibraryItem[];
  onTypeFilterChange: (value: TypeFilter) => void;
  onSourceFilterChange: (value: SourceFilter) => void;
  onTimeQualityFilterChange: (value: "all" | "exact" | "imported" | "estimated" | "undated") => void;
  onSelectItem: (id: string | null) => void;
  onSpreadThisMonth: () => void;
  onSpreadLastMonth: () => void;
  onSpreadLast6Months: () => void;
  onSpreadThisYear: () => void;
  onSpreadVeryOld: () => void;
  onAssignItemTime: (id: string, preset: "this_month" | "last_month" | "last_6_months" | "this_year" | "very_old") => void;
  onAssignSelectedThisMonth: () => void;
  onAssignSelectedLastMonth: () => void;
  onAssignSelectedLast6Months: () => void;
  onAssignSelectedThisYear: () => void;
  onAssignSelectedVeryOld: () => void;
  onMoveItemsToDate: (itemIds: string[], targetDate: number) => void;
  onDismissTimelinePrompt: () => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  dailyStepsByDay: Record<string, number>;
  healthStepsEnabled: boolean;
};

function typeTileStyle(type: LibraryItem["type"]) {
  if (type === "music") return appStyles.tilePink;
  if (type === "book") return appStyles.tileBlue;
  return appStyles.tileYellow;
}

function monthLabel(consumedAt?: number) {
  if (!consumedAt) return "без времени";
  return new Date(consumedAt)
    .toLocaleString("ru-RU", {
      month: "long",
      year: "numeric",
    })
    .toLowerCase();
}

function dayKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

const CalendarDayCell = memo(function CalendarDayCell({
  day,
  selected,
  themeMode,
  onPress,
}: {
  day: {
    key: string;
    date: Date;
    inMonth: boolean;
    items: LibraryItem[];
    steps: number;
  };
  selected: boolean;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  const theme = getTheme(themeMode);
  return (
    <Pressable
      style={[
        appStyles.calendarDay,
        themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        !day.inMonth && appStyles.calendarDayMuted,
        selected && [appStyles.calendarDayActive, themeMode === "dark" && { borderColor: theme.text, backgroundColor: "#22303A" }],
      ]}
      onPress={onPress}
    >
      <View style={appStyles.calendarDayHead}>
        <Text
          style={[
            appStyles.calendarDayNumber,
            { color: day.inMonth ? theme.text : theme.quietText },
            !day.inMonth && appStyles.calendarDayNumberMuted,
          ]}
        >
          {day.date.getDate()}
        </Text>
        {day.items.length > 0 ? <Text style={[appStyles.calendarDayCount, { color: theme.mutedText }]}>{day.items.length}</Text> : null}
      </View>
      {day.items.length > 0 ? (
        <View style={appStyles.calendarDotRow}>
          {Array.from(new Set(day.items.map((item) => item.type)))
            .slice(0, 3)
            .map((type) => (
              <View key={type} style={[appStyles.calendarDot, typeTileStyle(type as LibraryItem["type"])]} />
            ))}
        </View>
      ) : null}

      {day.steps > 0 ? <Text style={[appStyles.calendarStepsText, { color: theme.mutedText }]}>{`${Math.round(day.steps / 1000)}к шагов`}</Text> : null}

      {day.items.length > 1 ? <Text style={[appStyles.calendarMore, { color: theme.mutedText }]}>+ еще {day.items.length - 1}</Text> : null}
    </Pressable>
  );
});

const WeekDayPill = memo(function WeekDayPill({
  day,
  active,
  themeMode,
  onPress,
}: {
  day: {
    key: string;
    date: Date;
  };
  active: boolean;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  const theme = getTheme(themeMode);
  return (
    <Pressable
      style={[
        appStyles.weekDayChip,
        themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        active && [appStyles.weekDayChipActive, themeMode === "dark" && { backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBg }],
      ]}
      onPress={onPress}
    >
      <Text style={[appStyles.weekDayName, active && appStyles.weekDayNameActive, { color: active ? theme.buttonPrimaryText : theme.mutedText }]}>
        {day.date.toLocaleString("ru-RU", { weekday: "short" })}
      </Text>
      <Text style={[appStyles.weekDayNumber, active && appStyles.weekDayNumberActive, { color: active ? theme.buttonPrimaryText : theme.text }]}>
        {day.date.getDate()}
      </Text>
    </Pressable>
  );
});

const DayDetailCard = memo(function DayDetailCard({
  item,
  themeMode,
  onPress,
}: {
  item: LibraryItem;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  const theme = getTheme(themeMode);
  const consumedAt = getConsumptionDate(item);
  const compactTimeLabel = consumedAt
    ? new Date(consumedAt).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "без времени";
  return (
    <Pressable style={[appStyles.tile, appStyles.dayDetailTile, typeTileStyle(item.type)]} onPress={onPress}>
      <View style={appStyles.tileTopRow}>
        <View style={appStyles.typeBadge}>
          <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[item.type]}</Text>
        </View>
        <Text style={[appStyles.metaDate, appStyles.dayDetailDate, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
          {compactTimeLabel}
        </Text>
      </View>
      <Text numberOfLines={4} style={[appStyles.itemTitle, appStyles.dayDetailTitle]}>{item.title}</Text>
      <Text numberOfLines={2} style={[appStyles.itemMeta, appStyles.dayDetailMeta]}>{item.authorOrArtist || "без автора"}</Text>
      {getTimeOriginLabel(item.timeOrigin) ? (
        <Text numberOfLines={1} style={[appStyles.metaText, appStyles.dayDetailOrigin, { color: themeMode === "dark" ? theme.accentMutedText : theme.mutedText }]}>
          {getTimeOriginLabel(item.timeOrigin)}
        </Text>
      ) : null}
    </Pressable>
  );
});

export function LibraryScreen({
  themeMode,
  typeFilter,
  sourceFilter,
  timeQualityFilter,
  undatedVisibleLibrary,
  timelineSpreading,
  timelinePromptVisible,
  selectedItem,
  visibleLibrary,
  onTypeFilterChange,
  onSourceFilterChange,
  onTimeQualityFilterChange,
  onSelectItem,
  onSpreadThisMonth,
  onSpreadLastMonth,
  onSpreadLast6Months,
  onSpreadThisYear,
  onSpreadVeryOld,
  onAssignItemTime,
  onAssignSelectedThisMonth,
  onAssignSelectedLastMonth,
  onAssignSelectedLast6Months,
  onAssignSelectedThisYear,
  onAssignSelectedVeryOld,
  onMoveItemsToDate,
  onDismissTimelinePrompt,
  onEditItem,
  onDeleteItem,
  dailyStepsByDay,
  healthStepsEnabled,
}: LibraryScreenProps) {
  const theme = getTheme(themeMode);
  const [viewMode, setViewMode] = useState<LibraryViewMode>("calendar");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [selectedDayTypeFilter, setSelectedDayTypeFilter] = useState<TypeFilter>("all");
  const [dayModalVisible, setDayModalVisible] = useState(false);
  const [monthItemsModalVisible, setMonthItemsModalVisible] = useState(false);
  const [typeFiltersExpanded, setTypeFiltersExpanded] = useState(false);
  const [dateFiltersExpanded, setDateFiltersExpanded] = useState(false);
  const [daySelection, setDaySelection] = useState<string[]>([]);
  const [calendarMoveMode, setCalendarMoveMode] = useState(false);
  const [pendingMoveTargetKey, setPendingMoveTargetKey] = useState<string | null>(null);
  const [moveOriginDayKey, setMoveOriginDayKey] = useState<string | null>(null);
  const [returnDayKey, setReturnDayKey] = useState<string | null>(null);
  const [lastMovedTargetKey, setLastMovedTargetKey] = useState<string | null>(dayKey(new Date()));

  const typeFilterSummary = typeFilter === "all" ? "все" : TYPE_LABEL[typeFilter];
  const timeQualitySummary =
    timeQualityFilter === "all"
      ? "все"
      : timeQualityFilter === "exact"
        ? "точный день"
        : timeQualityFilter === "imported"
          ? "дата из сервиса"
          : timeQualityFilter === "estimated"
            ? "разложили вручную"
            : "пока без даты";

  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, LibraryItem[]>();
    for (const item of visibleLibrary) {
      const consumedAt = getConsumptionDate(item);
      if (!consumedAt) continue;
      const key = dayKey(new Date(consumedAt));
      const bucket = grouped.get(key) ?? [];
      bucket.push(item);
      grouped.set(key, bucket);
    }
    return grouped;
  }, [visibleLibrary]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const startWeekday = (monthStart.getDay() + 6) % 7;
    const gridStart = addDays(monthStart, -startWeekday);

    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(gridStart, index);
      const key = dayKey(date);
        return {
          key,
          date,
          inMonth: date.getMonth() === calendarMonth.getMonth(),
          isToday: key === dayKey(new Date()),
          items: itemsByDay.get(key) ?? [],
          steps: dailyStepsByDay[key] ?? 0,
        };
      });
  }, [calendarMonth, dailyStepsByDay, itemsByDay]);

  const selectedDay = useMemo(() => {
    if (selectedDayKey) {
      return calendarDays.find((entry) => entry.key === selectedDayKey) ?? null;
    }
    const todayKey = dayKey(new Date());
    const todayInMonth = calendarDays.find((entry) => entry.key === todayKey && entry.inMonth);
    if (todayInMonth) return todayInMonth;
    const firstWithItemsInMonth = calendarDays.find((entry) => entry.inMonth && entry.items.length > 0);
    return firstWithItemsInMonth ?? calendarDays.find((entry) => entry.inMonth) ?? null;
  }, [calendarDays, selectedDayKey]);

  const selectedWeek = useMemo(() => {
    if (!selectedDay) return [];
    const weekStart = addDays(selectedDay.date, -((selectedDay.date.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, index) => {
      const date = addDays(weekStart, index);
      const key = dayKey(date);
      return {
        key,
        date,
        items: itemsByDay.get(key) ?? [],
        steps: dailyStepsByDay[key] ?? 0,
      };
    });
  }, [dailyStepsByDay, itemsByDay, selectedDay]);

  const selectedDayItems = useMemo(() => {
    if (!selectedDay) return [];
    if (selectedDayTypeFilter === "all") return selectedDay.items;
    return selectedDay.items.filter((item) => item.type === selectedDayTypeFilter);
  }, [selectedDay, selectedDayTypeFilter]);

  const selectedDayCounts = useMemo(() => {
    const counts = {
      all: selectedDay?.items.length ?? 0,
      music: 0,
      book: 0,
      movie: 0,
    };
    if (!selectedDay) return counts;
    for (const item of selectedDay.items) {
      if (item.type === "music") counts.music += 1;
      if (item.type === "book") counts.book += 1;
      if (item.type === "movie") counts.movie += 1;
    }
    return counts;
  }, [selectedDay]);

  const monthLevelItems = useMemo(() => {
    return visibleLibrary
      .filter((item) => {
        const consumedAt = getConsumptionDate(item);
        if (!consumedAt) return false;
        const consumedDate = new Date(consumedAt);
        return (
          item.timeOrigin === "estimated" &&
          consumedDate.getFullYear() === calendarMonth.getFullYear() &&
          consumedDate.getMonth() === calendarMonth.getMonth()
        );
      })
      .sort((left, right) => {
        const leftTime = getConsumptionDate(left) ?? 0;
        const rightTime = getConsumptionDate(right) ?? 0;
        return rightTime - leftTime;
      });
  }, [calendarMonth, visibleLibrary]);

  useEffect(() => {
    if (selectedDay) {
      const timeout = setTimeout(() => setSelectedDayKey(selectedDay.key), 0);
      return () => clearTimeout(timeout);
    }
  }, [selectedDay?.key]);

  useEffect(() => {
    const timeout = setTimeout(() => setSelectedDayTypeFilter("all"), 0);
    return () => clearTimeout(timeout);
  }, [selectedDayKey, dayModalVisible]);

  function openDay(dateKey: string) {
    if (calendarMoveMode) {
      setPendingMoveTargetKey(dateKey);
      return;
    }
    setSelectedDayKey(dateKey);
    setSelectedDayTypeFilter("all");
    setDaySelection([]);
    setDayModalVisible(true);
  }

  const pendingMoveTarget = useMemo(
    () => (pendingMoveTargetKey ? calendarDays.find((entry) => entry.key === pendingMoveTargetKey) ?? null : null),
    [calendarDays, pendingMoveTargetKey]
  );

  function toggleDaySelection(itemId: string) {
    setDaySelection((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  }

  function startCalendarMoveMode() {
    if (daySelection.length === 0) return;
    setMoveOriginDayKey(selectedDay?.key ?? null);
    setReturnDayKey(null);
    setDayModalVisible(false);
    setCalendarMoveMode(true);
  }

  function cancelCalendarMoveMode() {
    setCalendarMoveMode(false);
    setPendingMoveTargetKey(null);
    setDaySelection([]);
  }

  function confirmMoveSelection() {
    if (!pendingMoveTarget || daySelection.length === 0) return;
    onMoveItemsToDate(daySelection, pendingMoveTarget.date.getTime());
    setReturnDayKey(moveOriginDayKey);
    setLastMovedTargetKey(pendingMoveTarget.key);
    setCalendarMoveMode(false);
    setPendingMoveTargetKey(null);
    setDaySelection([]);
    setMoveOriginDayKey(null);
  }

  const returnDay = useMemo(
    () => (returnDayKey ? calendarDays.find((entry) => entry.key === returnDayKey) ?? null : null),
    [calendarDays, returnDayKey]
  );
  const lastMovedTargetDay = useMemo(
    () => (lastMovedTargetKey ? calendarDays.find((entry) => entry.key === lastMovedTargetKey) ?? null : null),
    [calendarDays, lastMovedTargetKey]
  );

  function jumpBackToReturnDay() {
    if (!returnDay) return;
    setCalendarMonth(startOfMonth(returnDay.date));
    setSelectedDayKey(returnDay.key);
    setSelectedDayTypeFilter("all");
    setPendingMoveTargetKey(null);
    setCalendarMoveMode(false);
    setDaySelection([]);
    setDayModalVisible(true);
    setReturnDayKey(null);
  }

  function renderTopCards() {
    return (
      <View style={appStyles.libraryListTop}>
        <View style={[appStyles.card, appStyles.cardAccentPink, appStyles.libraryTopCompactCard]}>
          <Text style={appStyles.sectionTitle}>библиотека</Text>
          <View style={appStyles.compactFilterSection}>
            <Text style={[appStyles.compactFilterHeader, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>отображение</Text>
            <View style={appStyles.compactFilterRow}>
              <PillButton
                themeMode={themeMode}
                style={appStyles.compactPillButton}
                label="плитки"
                active={viewMode === "tiles"}
                onPress={() => setViewMode("tiles")}
              />
              <PillButton
                themeMode={themeMode}
                style={appStyles.compactPillButton}
                label="календарь"
                active={viewMode === "calendar"}
                onPress={() => setViewMode("calendar")}
              />
            </View>
          </View>

          <Text style={[appStyles.helper, appStyles.libraryIntroCompact, { color: themeMode === "dark" ? theme.accentText : theme.text }]}>
            смотри все вместе или раскладывай по типам и по тому, как проставлены даты.
          </Text>

          <View style={appStyles.compactFilterSection}>
            <Pressable style={appStyles.compactAccordionHeader} onPress={() => setTypeFiltersExpanded((current) => !current)}>
              <Text style={[appStyles.compactFilterHeader, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>тип контента</Text>
              <View style={appStyles.compactAccordionMeta}>
                <Text style={[appStyles.compactAccordionValue, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>{typeFilterSummary}</Text>
                <Text style={[appStyles.compactAccordionChevron, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
                  {typeFiltersExpanded ? "−" : "+"}
                </Text>
              </View>
            </Pressable>
            {typeFiltersExpanded ? (
              <View style={appStyles.compactFilterRow}>
                {(["all", "music", "book", "movie"] as TypeFilter[]).map((value) => (
                  <PillButton
                    key={value}
                    themeMode={themeMode}
                    style={appStyles.compactPillButton}
                    label={value === "all" ? "все" : TYPE_LABEL[value]}
                    active={typeFilter === value}
                    onPress={() => onTypeFilterChange(value)}
                  />
                ))}
              </View>
            ) : null}
          </View>

          <View style={appStyles.compactFilterSection}>
            <Pressable style={appStyles.compactAccordionHeader} onPress={() => setDateFiltersExpanded((current) => !current)}>
              <Text style={[appStyles.compactFilterHeader, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>как проставлена дата</Text>
              <View style={appStyles.compactAccordionMeta}>
                <Text style={[appStyles.compactAccordionValue, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>{timeQualitySummary}</Text>
                <Text style={[appStyles.compactAccordionChevron, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
                  {dateFiltersExpanded ? "−" : "+"}
                </Text>
              </View>
            </Pressable>
            {dateFiltersExpanded ? (
              <View style={appStyles.compactFilterRow}>
                {(
                  [
                    ["all", "все"],
                    ["exact", "точный день"],
                    ["imported", "дата из сервиса"],
                    ["estimated", "разложили вручную"],
                    ["undated", "пока без даты"],
                  ] as const
                ).map(([value, label]) => (
                  <PillButton
                    key={value}
                    themeMode={themeMode}
                    style={appStyles.compactPillButton}
                    label={label}
                    active={timeQualityFilter === value}
                    onPress={() => onTimeQualityFilterChange(value)}
                  />
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {timelinePromptVisible && undatedVisibleLibrary.length > 0 ? (
          <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentGreen, borderColor: theme.border } : appStyles.cardAccentGreen]}>
            <Text style={appStyles.sectionTitle}>когда это было?</Text>
            <Text style={[appStyles.helper, { color: themeMode === "dark" ? theme.accentText : theme.text }]}>
              мы добавили {undatedVisibleLibrary.length} импортированн{undatedVisibleLibrary.length === 1 ? "ую карточку" : "ых карточек"} без времени. выбери, как это примерно разложить по твоей линии времени.
            </Text>
            <View style={appStyles.row}>
              <PillButton
                label={timelineSpreading ? "раскладываем..." : "это было недавно"}
                themeMode={themeMode}
                onPress={onSpreadThisMonth}
                disabled={timelineSpreading}
              />
              <PillButton themeMode={themeMode} label="это было в прошлом месяце" onPress={onSpreadLastMonth} disabled={timelineSpreading} />
              <PillButton themeMode={themeMode} label="это было за последние полгода" onPress={onSpreadLast6Months} disabled={timelineSpreading} />
              <PillButton themeMode={themeMode} label="это было в этом году" onPress={onSpreadThisYear} disabled={timelineSpreading} />
              <PillButton themeMode={themeMode} label="это было очень давно" onPress={onSpreadVeryOld} disabled={timelineSpreading} />
              <PillButton themeMode={themeMode} label="разложу потом" onPress={onDismissTimelinePrompt} disabled={timelineSpreading} />
            </View>
          </View>
        ) : null}

      </View>
    );
  }

  function renderTileItem({ item }: { item: LibraryItem }) {
    return (
      <Pressable
        style={[appStyles.tile, appStyles.libraryTile, typeTileStyle(item.type)]}
        onPress={() => onSelectItem(item.id)}
      >
        <View style={appStyles.tileTopRow}>
          <View style={appStyles.typeBadge}>
            <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[item.type]}</Text>
          </View>
          <Text style={[appStyles.metaDate, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
            {getConsumptionDate(item) ? formatFullDate(getConsumptionDate(item) as number) : "без времени"}
          </Text>
        </View>

        <View>
          <Text style={appStyles.itemMeta}>{item.authorOrArtist || TYPE_LABEL[item.type]}</Text>
          <Text style={appStyles.itemTitle}>{item.title}</Text>
        </View>
        {getTimeOriginLabel(item.timeOrigin) ? (
          <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>{getTimeOriginLabel(item.timeOrigin)}</Text>
        ) : null}

        {!getConsumptionDate(item) ? (
          <View style={appStyles.row}>
            <PillButton themeMode={themeMode} label="недавно" onPress={() => onAssignItemTime(item.id, "this_month")} disabled={timelineSpreading} />
            <PillButton themeMode={themeMode} label="месяц" onPress={() => onAssignItemTime(item.id, "last_month")} disabled={timelineSpreading} />
            <PillButton themeMode={themeMode} label="полгода" onPress={() => onAssignItemTime(item.id, "last_6_months")} disabled={timelineSpreading} />
          </View>
        ) : null}
      </Pressable>
    );
  }

  function renderCalendarView() {
    return (
      <ScrollView style={appStyles.scroll} contentContainerStyle={appStyles.libraryListContent} showsVerticalScrollIndicator={false}>
        {renderTopCards()}

        <View style={[appStyles.card, appStyles.calendarCard, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {calendarMoveMode ? (
            <View style={[appStyles.card, appStyles.calendarMoveBanner, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
              <Text style={[appStyles.sectionTitle, appStyles.calendarMoveTitle, { color: theme.text }]}>выбери новый день</Text>
              <Text style={[appStyles.helper, { color: theme.text }]}>
                переносим {daySelection.length} {daySelection.length === 1 ? "айтем" : daySelection.length < 5 ? "айтема" : "айтемов"}.
              </Text>
              <PillButton themeMode={themeMode} label="отмена" onPress={cancelCalendarMoveMode} />
            </View>
          ) : returnDay ? (
            <View style={[appStyles.card, appStyles.calendarMoveBanner, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
              <Text style={[appStyles.sectionTitle, appStyles.calendarMoveTitle, { color: theme.text }]}>
                {lastMovedTargetDay
                  ? `перенесли на ${lastMovedTargetDay.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`
                  : "дату перенесли"}
              </Text>
              <Text style={[appStyles.helper, { color: theme.text }]}>
                если хочешь, можно сразу вернуться к прежнему дню.
              </Text>
              <PillButton
                themeMode={themeMode}
                label={`вернуться к ${returnDay.date.toLocaleString("ru-RU", { day: "numeric", month: "long" })}`}
                onPress={jumpBackToReturnDay}
              />
            </View>
          ) : null}

          <View style={appStyles.calendarTopRow}>
            <Pressable style={[appStyles.calendarArrow, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}>
              <Text style={[appStyles.calendarArrowText, { color: theme.text }]}>‹</Text>
            </Pressable>
            <Text style={[appStyles.calendarTitle, { color: theme.text }]}>
              {calendarMonth
                .toLocaleString("ru-RU", { month: "long", year: "numeric" })
                .replace(/\sг\.$/, "")
                .replace(/^./, (char) => char.toUpperCase())}
            </Text>
            <View style={appStyles.calendarTopActions}>
              <Pressable
                style={[appStyles.calendarArrow, appStyles.calendarTodayButton, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() => {
                  const today = new Date();
                  setCalendarMonth(startOfMonth(today));
                  setSelectedDayKey(dayKey(today));
                }}
              >
                <Text style={[appStyles.calendarTodayText, { color: theme.text }]}>сегодня</Text>
              </Pressable>
              <Pressable style={[appStyles.calendarArrow, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}>
                <Text style={[appStyles.calendarArrowText, { color: theme.text }]}>›</Text>
              </Pressable>
            </View>
          </View>

          <View style={appStyles.calendarWeekdays}>
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((label) => (
              <Text key={label} style={[appStyles.calendarWeekday, { color: theme.mutedText }]}>
                {label}
              </Text>
            ))}
          </View>

          <View style={appStyles.calendarGrid}>
            {calendarDays.map((day) => (
              <CalendarDayCell
                key={day.key}
                day={day}
                selected={day.key === selectedDay?.key}
                themeMode={themeMode}
                onPress={() => openDay(day.key)}
              />
            ))}
          </View>
        </View>

        {monthLevelItems.length > 0 ? (
          <Pressable
            style={[
              appStyles.card,
              appStyles.monthLevelCard,
              appStyles.cardAccentYellow,
              themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
            onPress={() => setMonthItemsModalVisible(true)}
          >
            <View style={appStyles.monthLevelTopRow}>
              <View style={appStyles.monthLevelTextBlock}>
                <Text style={appStyles.monthLevelTitle}>а еще в этом месяце было</Text>
                <Text style={[appStyles.helper, appStyles.monthLevelBody, { color: theme.text }]}>
                  {monthLevelItems.length} {monthLevelItems.length === 1 ? "айтем" : monthLevelItems.length < 5 ? "айтема" : "айтемов"} без
                  точного дня.
                </Text>
              </View>
              <View style={[appStyles.statusChip, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Text style={[appStyles.statusChipText, { color: themeMode === "dark" ? theme.text : undefined }]}>{monthLevelItems.length}</Text>
              </View>
            </View>
            <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.mutedText : undefined }]}>нажми, чтобы открыть список</Text>
          </Pressable>
        ) : null}

      </ScrollView>
    );
  }

  return (
    <View style={appStyles.libraryScreen}>
      {viewMode === "calendar" ? (
        renderCalendarView()
      ) : (
        <FlatList
          data={visibleLibrary}
          keyExtractor={(item, index) => reactItemKey(item, index)}
          renderItem={renderTileItem}
          numColumns={2}
          ListHeaderComponent={renderTopCards}
          ListEmptyComponent={
            <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Text style={[appStyles.helper, { color: theme.text }]}>пока пусто. попробуй импорт из spotify, импорт изображений или загрузку файла.</Text>
            </View>
          }
          contentContainerStyle={appStyles.libraryListContent}
          columnWrapperStyle={appStyles.libraryColumn}
          ItemSeparatorComponent={() => <View style={appStyles.libraryListSpacer} />}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={14}
          windowSize={7}
        />
      )}

      <Modal visible={dayModalVisible && Boolean(selectedDay)} transparent animationType="fade" onRequestClose={() => setDayModalVisible(false)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.dayModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {selectedDay ? (
              <>
                <View style={appStyles.dayModalTopRow}>
                  <View style={appStyles.dayModalHeading}>
                    <Text style={[appStyles.sectionTitle, appStyles.dayModalTitle, { color: theme.text }]}>
                      {selectedDay.date
                        .toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                        .replace(/^./, (char) => char.toUpperCase())}
                    </Text>
                  </View>
                  <Pressable style={[appStyles.dayModalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => setDayModalVisible(false)}>
                    <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>закрыть</Text>
                  </Pressable>
                </View>

                <ScrollView
                  horizontal
                  style={appStyles.weekStripScroll}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={appStyles.weekStrip}
                  automaticallyAdjustContentInsets={false}
                  contentInsetAdjustmentBehavior="never"
                >
                  {selectedWeek.map((day) => (
                    <WeekDayPill
                      key={day.key}
                      day={day}
                      active={day.key === selectedDay.key}
                      themeMode={themeMode}
                      onPress={() => setSelectedDayKey(day.key)}
                    />
                  ))}
                </ScrollView>

                {healthStepsEnabled && selectedDay.steps > 0 ? (
                  <View style={[appStyles.card, appStyles.dayStepsCard, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    <Text style={[appStyles.dayStepsTitle, { color: theme.text }]}>шаги</Text>
                    <Text style={[appStyles.dayStepsValue, { color: theme.text }]}>
                      {selectedDay.steps.toLocaleString("ru-RU")}
                    </Text>
                    <Text style={[appStyles.metaText, { color: theme.mutedText }]}>из приложения «здоровье», когда подключим интеграцию</Text>
                  </View>
                ) : null}

                <View style={appStyles.dayTypeFilterRow}>
                  {(["all", "music", "book", "movie"] as TypeFilter[]).map((value) => (
                    <PillButton
                      key={value}
                      themeMode={themeMode}
                      style={appStyles.dayTypeFilterPill}
                      label={
                        value === "all"
                          ? `все ${selectedDayCounts.all}`
                          : `${TYPE_LABEL[value]} ${selectedDayCounts[value]}`
                      }
                      active={selectedDayTypeFilter === value}
                      onPress={() => setSelectedDayTypeFilter(value)}
                    />
                  ))}
                </View>

                <FlatList
                  key={`${selectedDay.key}-${selectedDayTypeFilter}`}
                  data={selectedDayItems}
                  numColumns={3}
                  keyExtractor={(item, index) => reactItemKey(item, index)}
                  renderItem={({ item }) => (
                    <Pressable style={appStyles.dayGridPressable} onPress={() => toggleDaySelection(item.id)}>
                      <DayDetailCard item={item} themeMode={themeMode} onPress={() => toggleDaySelection(item.id)} />
                      {daySelection.includes(item.id) ? (
                        <View style={appStyles.daySelectionBadge}>
                          <Text style={appStyles.daySelectionBadgeText}>выбрано</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  )}
                  style={appStyles.dayModalScroll}
                  contentContainerStyle={appStyles.dayModalContent}
                  columnWrapperStyle={appStyles.dayModalGridRow}
                  showsVerticalScrollIndicator={false}
                  automaticallyAdjustContentInsets={false}
                  contentInsetAdjustmentBehavior="never"
                  ListEmptyComponent={
                    <View style={[appStyles.card, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                      <Text style={[appStyles.helper, { color: theme.text }]}>
                        {selectedDayTypeFilter === "all" ? "в этот день пока пусто." : "в этот день пока ничего не было в этой категории."}
                      </Text>
                    </View>
                  }
                  ListHeaderComponent={
                    daySelection.length > 0 ? (
                      <View style={appStyles.dayActionRow}>
                        <PillButton
                          themeMode={themeMode}
                          style={appStyles.dayActionPill}
                          label={daySelection.length === 1 ? "изменить дату" : `изменить дату (${daySelection.length})`}
                          onPress={startCalendarMoveMode}
                        />
                        <PillButton
                          themeMode={themeMode}
                          style={appStyles.dayActionPill}
                          label="снять выбор"
                          onPress={() => setDaySelection([])}
                        />
                      </View>
                    ) : null
                  }
                />
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(pendingMoveTarget) && calendarMoveMode} transparent animationType="fade" onRequestClose={() => setPendingMoveTargetKey(null)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.guideModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[appStyles.sectionTitle, { color: theme.text }]}>перенести на другой день?</Text>
            <Text style={[appStyles.helper, { color: theme.text }]}>
              перенесем {daySelection.length} {daySelection.length === 1 ? "айтем" : daySelection.length < 5 ? "айтема" : "айтемов"} на{" "}
              {pendingMoveTarget?.date
                .toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
                .replace(/^./, (char) => char.toUpperCase())}
              .
            </Text>
            <View style={appStyles.dayActionRow}>
              <PillButton themeMode={themeMode} style={appStyles.dayActionPill} label="да, перенести" onPress={confirmMoveSelection} />
              <PillButton themeMode={themeMode} style={appStyles.dayActionPill} label="не сейчас" onPress={() => setPendingMoveTargetKey(null)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(selectedItem)} transparent animationType="fade" onRequestClose={() => onSelectItem(null)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.guideModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {selectedItem ? (
              <>
                <View style={appStyles.dayModalTopRow}>
                  <View style={appStyles.dayModalHeading}>
                    <Text style={[appStyles.sectionTitle, { color: theme.text }]}>карточка</Text>
                  </View>
                  <Pressable style={[appStyles.dayModalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => onSelectItem(null)}>
                    <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>закрыть</Text>
                  </Pressable>
                </View>
                <View style={[appStyles.tile, typeTileStyle(selectedItem.type)]}>
                  <View style={appStyles.tileTopRow}>
                    <View style={appStyles.typeBadge}>
                      <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[selectedItem.type]}</Text>
                    </View>
                    <Text style={[appStyles.metaDate, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
                      {getConsumptionDate(selectedItem)
                        ? formatFullDate(getConsumptionDate(selectedItem) as number)
                        : "выбери время"}
                    </Text>
                  </View>
                  <Text style={appStyles.itemTitle}>{selectedItem.title}</Text>
                  <Text style={appStyles.itemMeta}>{selectedItem.authorOrArtist || "без автора"}</Text>
                  {getTimeOriginLabel(selectedItem.timeOrigin) ? (
                    <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
                      {getTimeOriginLabel(selectedItem.timeOrigin)}
                    </Text>
                  ) : null}
                  {!getConsumptionDate(selectedItem) ? (
                    <View style={appStyles.stack}>
                      <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentMutedText : theme.mutedText }]}>когда это было примерно?</Text>
                      <View style={appStyles.row}>
                        <PillButton themeMode={themeMode} label="недавно" onPress={onAssignSelectedThisMonth} disabled={timelineSpreading} />
                        <PillButton themeMode={themeMode} label="прошлый месяц" onPress={onAssignSelectedLastMonth} disabled={timelineSpreading} />
                        <PillButton themeMode={themeMode} label="полгода" onPress={onAssignSelectedLast6Months} disabled={timelineSpreading} />
                        <PillButton themeMode={themeMode} label="этот год" onPress={onAssignSelectedThisYear} disabled={timelineSpreading} />
                        <PillButton themeMode={themeMode} label="очень давно" onPress={onAssignSelectedVeryOld} disabled={timelineSpreading} />
                      </View>
                    </View>
                  ) : null}
                </View>
                <View style={appStyles.dayActionRow}>
                  <PillButton themeMode={themeMode} style={appStyles.dayActionPill} label="редактировать" onPress={() => onEditItem(selectedItem.id)} />
                  <PillButton themeMode={themeMode} style={appStyles.dayActionPill} label="удалить" variant="danger" onPress={() => onDeleteItem(selectedItem.id)} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal visible={monthItemsModalVisible} transparent animationType="fade" onRequestClose={() => setMonthItemsModalVisible(false)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.dayModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={appStyles.dayModalTopRow}>
              <View style={appStyles.dayModalHeading}>
                <Text style={[appStyles.sectionTitle, appStyles.dayModalTitle, { color: theme.text }]}>а еще в этом месяце было</Text>
                <Text style={[appStyles.helper, appStyles.monthLevelModalText, { color: theme.text }]}>
                  это вещи без точного дня. мы только знаем, что они попали примерно в этот месяц.
                </Text>
              </View>
              <Pressable style={[appStyles.dayModalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => setMonthItemsModalVisible(false)}>
                <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>закрыть</Text>
              </Pressable>
            </View>

            <FlatList
              key={`${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}-month-items`}
              data={monthLevelItems}
              keyExtractor={(item, index) => reactItemKey(item, index)}
              renderItem={({ item }) => (
                <DayDetailCard item={item} themeMode={themeMode} onPress={() => onSelectItem(item.id)} />
              )}
              style={appStyles.dayModalScroll}
              contentContainerStyle={appStyles.dayModalContent}
              showsVerticalScrollIndicator={false}
              automaticallyAdjustContentInsets={false}
              contentInsetAdjustmentBehavior="never"
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
