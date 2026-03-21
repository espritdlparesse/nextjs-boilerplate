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
  onSelectItem: (id: string) => void;
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
  onDismissTimelinePrompt: () => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
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

      {day.items.slice(0, 2).map((item) => (
        <View key={item.id} style={[appStyles.calendarItemChip, typeTileStyle(item.type)]}>
          <Text style={appStyles.calendarItemChipText} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      ))}

      {day.items.length > 2 ? <Text style={[appStyles.calendarMore, { color: theme.mutedText }]}>+ еще {day.items.length - 2}</Text> : null}
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
  return (
    <Pressable style={[appStyles.tile, typeTileStyle(item.type)]} onPress={onPress}>
      <View style={appStyles.tileTopRow}>
        <View style={appStyles.typeBadge}>
          <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[item.type]}</Text>
        </View>
        <Text style={[appStyles.metaDate, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
          {formatFullDate(getConsumptionDate(item) as number)}
        </Text>
      </View>
      <Text style={appStyles.itemTitle}>{item.title}</Text>
      <Text style={appStyles.itemMeta}>{item.authorOrArtist || "без автора"}</Text>
      {getTimeOriginLabel(item.timeOrigin) ? (
        <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentMutedText : theme.mutedText }]}>
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
  onDismissTimelinePrompt,
  onEditItem,
  onDeleteItem,
}: LibraryScreenProps) {
  const theme = getTheme(themeMode);
  const [viewMode, setViewMode] = useState<LibraryViewMode>("tiles");
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [dayModalVisible, setDayModalVisible] = useState(false);

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
      };
    });
  }, [calendarMonth, itemsByDay]);

  const selectedDay = useMemo(() => {
    if (selectedDayKey) {
      return calendarDays.find((entry) => entry.key === selectedDayKey) ?? null;
    }
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
      };
    });
  }, [itemsByDay, selectedDay]);

  useEffect(() => {
    if (selectedDay) {
      setSelectedDayKey(selectedDay.key);
    }
  }, [selectedDay?.key]);

  function openDay(dateKey: string) {
    setSelectedDayKey(dateKey);
    setDayModalVisible(true);
  }

  function renderTopCards() {
    return (
      <View style={appStyles.libraryListTop}>
        <View style={[appStyles.card, appStyles.cardAccentPink]}>
          <Text style={appStyles.sectionTitle}>библиотека</Text>
          <Text style={[appStyles.helper, { color: themeMode === "dark" ? theme.accentText : theme.text }]}>
            смотри все вместе или раскладывай по типам. в карточках видна дата, чтобы библиотека ощущалась как личная история, а не архив.
          </Text>

          <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>режим</Text>
          <View style={appStyles.row}>
            <PillButton themeMode={themeMode} label="плитки" active={viewMode === "tiles"} onPress={() => setViewMode("tiles")} />
            <PillButton themeMode={themeMode} label="календарь" active={viewMode === "calendar"} onPress={() => setViewMode("calendar")} />
          </View>

          <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>тип контента</Text>
          <View style={appStyles.row}>
            {(["all", "music", "book", "film"] as TypeFilter[]).map((value) => (
              <PillButton
                key={value}
                themeMode={themeMode}
                label={value === "all" ? "все" : TYPE_LABEL[value]}
                active={typeFilter === value}
                onPress={() => onTypeFilterChange(value)}
              />
            ))}
          </View>

          <Text style={[appStyles.label, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>дата</Text>
          <View style={appStyles.row}>
            {(
              [
                ["all", "все"],
                ["exact", "точные"],
                ["imported", "из импорта"],
                ["estimated", "примерно"],
                ["undated", "без даты"],
              ] as const
            ).map(([value, label]) => (
              <PillButton
                key={value}
                themeMode={themeMode}
                label={label}
                active={timeQualityFilter === value}
                onPress={() => onTimeQualityFilterChange(value)}
              />
            ))}
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

        {selectedItem ? (
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
              <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>{getTimeOriginLabel(selectedItem.timeOrigin)}</Text>
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
            <PillButton themeMode={themeMode} label="редактировать" onPress={() => onEditItem(selectedItem.id)} />
            <PillButton themeMode={themeMode} label="удалить" variant="danger" onPress={() => onDeleteItem(selectedItem.id)} />
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
            <Pressable style={[appStyles.calendarArrow, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}>
              <Text style={[appStyles.calendarArrowText, { color: theme.text }]}>›</Text>
            </Pressable>
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
          keyExtractor={(item) => item.id}
          renderItem={renderTileItem}
          numColumns={2}
          ListHeaderComponent={renderTopCards}
          ListEmptyComponent={
            <View style={appStyles.card}>
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
                    <Text style={appStyles.sectionTitle}>
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

                <View style={appStyles.weekStrip}>
                  {selectedWeek.map((day) => (
                    <WeekDayPill
                      key={day.key}
                      day={day}
                      active={day.key === selectedDay.key}
                      themeMode={themeMode}
                      onPress={() => setSelectedDayKey(day.key)}
                    />
                  ))}
                </View>

                <ScrollView style={appStyles.dayModalScroll} contentContainerStyle={appStyles.dayModalContent} showsVerticalScrollIndicator={false}>
                  {selectedDay.items.length > 0 ? (
                    selectedDay.items.map((item) => (
                      <DayDetailCard key={item.id} item={item} themeMode={themeMode} onPress={() => onSelectItem(item.id)} />
                    ))
                  ) : (
                    <View style={appStyles.card}>
                      <Text style={[appStyles.helper, { color: theme.text }]}>в этот день пока пусто.</Text>
                    </View>
                  )}
                </ScrollView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}
