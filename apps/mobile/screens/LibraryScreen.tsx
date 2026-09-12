import type { TimelineSpreadPreset } from "../hooks/timelineTypes";
import { useEffect, useMemo, useState } from "react";
import { dayKey, startOfMonth, addDays, calendarGrid } from "../../../lib/dates";
import { itemsWord } from "../../../lib/plural";
import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  getConsumptionDate,
  type ContentType,
  type LibraryItem,
  type SourceType,
  type ThemeMode,
} from "../shared/everyyou/domain";
import { LibraryFilters, type LibraryViewMode } from "../components/LibraryFilters";
import { CalendarBanner, CalendarMonthGrid, MonthLevelCard } from "../components/Calendar";
import { PillButton } from "../components/PillButton";
import { DayDetailCard, reactItemKey } from "../components/dayCards";
import { ItemCardModal } from "../components/ItemCardModal";
import { DayModal } from "../components/DayModal";
import { LibraryTile } from "../components/LibraryTile";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type TypeFilter = ContentType | "all";
type SourceFilter = SourceType | "all";


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
  onSpread: (preset: TimelineSpreadPreset) => void;
  onAssignItemTime: (id: string, preset: "this_month" | "last_month" | "last_6_months" | "this_year" | "very_old") => void;
  onAssignSelected: (preset: TimelineSpreadPreset) => void;
  onMoveItemsToDate: (itemIds: string[], targetDate: number) => void;
  onDismissTimelinePrompt: () => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  dailyStepsByDay: Record<string, number>;
  healthStepsEnabled: boolean;
};



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
  onSpread,
  onAssignItemTime,
  onAssignSelected,
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
  const [daySelection, setDaySelection] = useState<string[]>([]);
  const [calendarMoveMode, setCalendarMoveMode] = useState(false);
  const [pendingMoveTargetKey, setPendingMoveTargetKey] = useState<string | null>(null);
  const [moveOriginDayKey, setMoveOriginDayKey] = useState<string | null>(null);
  const [returnDayKey, setReturnDayKey] = useState<string | null>(null);
  const [lastMovedTargetKey, setLastMovedTargetKey] = useState<string | null>(dayKey(new Date()));

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

  const calendarDays = useMemo(
    () =>
      calendarGrid(calendarMonth).map((day) => ({
        ...day,
        items: itemsByDay.get(day.key) ?? [],
        steps: dailyStepsByDay[day.key] ?? 0,
      })),
    [calendarMonth, dailyStepsByDay, itemsByDay]
  );

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

  function renderCalendarView() {
    return (
      <ScrollView style={appStyles.scroll} contentContainerStyle={appStyles.libraryListContent} showsVerticalScrollIndicator={false}>
          <LibraryFilters
            themeMode={themeMode}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            typeFilter={typeFilter}
            onTypeFilterChange={onTypeFilterChange}
            timeQualityFilter={timeQualityFilter}
            onTimeQualityFilterChange={onTimeQualityFilterChange}
            timelinePromptVisible={timelinePromptVisible}
            undatedVisibleLibrary={undatedVisibleLibrary}
            timelineSpreading={timelineSpreading}
            onSpread={onSpread}
            onDismissTimelinePrompt={onDismissTimelinePrompt}
          />

        <View style={[appStyles.card, appStyles.calendarCard, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <CalendarBanner
            themeMode={themeMode}
            moveMode={calendarMoveMode}
            selectionCount={daySelection.length}
            onCancelMove={cancelCalendarMoveMode}
            returnDay={returnDay}
            lastMovedTargetDay={lastMovedTargetDay}
            onJumpBack={jumpBackToReturnDay}
          />

          <CalendarMonthGrid
            themeMode={themeMode}
            month={calendarMonth}
            onMonthChange={setCalendarMonth}
            days={calendarDays}
            selectedKey={selectedDay?.key}
            onOpenDay={openDay}
            onSelectDayKey={setSelectedDayKey}
          />
        </View>

        <MonthLevelCard
          themeMode={themeMode}
          count={monthLevelItems.length}
          onPress={() => setMonthItemsModalVisible(true)}
        />

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
          renderItem={({ item }) => <LibraryTile item={item} theme={theme} themeMode={themeMode} onSelectItem={onSelectItem} onAssignItemTime={onAssignItemTime} timelineSpreading={timelineSpreading} />}
          numColumns={2}
          ListHeaderComponent={
            <LibraryFilters
              themeMode={themeMode}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              typeFilter={typeFilter}
              onTypeFilterChange={onTypeFilterChange}
              timeQualityFilter={timeQualityFilter}
              onTimeQualityFilterChange={onTimeQualityFilterChange}
              timelinePromptVisible={timelinePromptVisible}
              undatedVisibleLibrary={undatedVisibleLibrary}
              timelineSpreading={timelineSpreading}
              onSpread={onSpread}
              onDismissTimelinePrompt={onDismissTimelinePrompt}
            />
          }
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

      <DayModal
        visible={dayModalVisible}
        day={selectedDay}
        week={selectedWeek}
        items={selectedDayItems}
        counts={selectedDayCounts}
        typeFilter={selectedDayTypeFilter}
        selection={daySelection}
        healthStepsEnabled={healthStepsEnabled}
        themeMode={themeMode}
        onClose={() => setDayModalVisible(false)}
        onSelectDayKey={setSelectedDayKey}
        onTypeFilterChange={setSelectedDayTypeFilter}
        onToggleSelection={toggleDaySelection}
        onClearSelection={() => setDaySelection([])}
        onStartMove={startCalendarMoveMode}
      />

      <Modal visible={Boolean(pendingMoveTarget) && calendarMoveMode} transparent animationType="fade" onRequestClose={() => setPendingMoveTargetKey(null)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.guideModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[appStyles.sectionTitle, { color: theme.text }]}>перенести на другой день?</Text>
            <Text style={[appStyles.helper, { color: theme.text }]}>
              перенесем {daySelection.length} {itemsWord(daySelection.length)} на{" "}
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

      <ItemCardModal
        item={selectedItem}
        themeMode={themeMode}
        timelineSpreading={timelineSpreading}
        onClose={() => onSelectItem(null)}
        onAssignSelected={onAssignSelected}
        onEditItem={onEditItem}
        onDeleteItem={onDeleteItem}
      />

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
              <Pressable style={[appStyles.modalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => setMonthItemsModalVisible(false)}>
                <Text style={[appStyles.modalCloseText, { color: theme.text }]}>×</Text>
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
