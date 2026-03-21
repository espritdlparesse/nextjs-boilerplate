import { memo, useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import {
  formatFullDate,
  getConsumptionDate,
  TYPE_LABEL,
  type ContentType,
  type LibraryItem,
  type SourceType,
} from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type TypeFilter = ContentType | "all";
type SourceFilter = SourceType | "all";
type LibraryViewMode = "tiles" | "calendar";

type LibraryScreenProps = {
  typeFilter: TypeFilter;
  sourceFilter: SourceFilter;
  undatedVisibleLibrary: LibraryItem[];
  timelineSpreading: boolean;
  timelinePromptVisible: boolean;
  selectedItem: LibraryItem | null;
  visibleLibrary: LibraryItem[];
  onTypeFilterChange: (value: TypeFilter) => void;
  onSourceFilterChange: (value: SourceFilter) => void;
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
  onPress,
}: {
  day: {
    key: string;
    date: Date;
    inMonth: boolean;
    items: LibraryItem[];
  };
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        appStyles.calendarDay,
        !day.inMonth && appStyles.calendarDayMuted,
        selected && appStyles.calendarDayActive,
      ]}
      onPress={onPress}
    >
      <View style={appStyles.calendarDayHead}>
        <Text style={[appStyles.calendarDayNumber, !day.inMonth && appStyles.calendarDayNumberMuted]}>
          {day.date.getDate()}
        </Text>
        {day.items.length > 0 ? <Text style={appStyles.calendarDayCount}>{day.items.length}</Text> : null}
      </View>

      {day.items.slice(0, 2).map((item) => (
        <View key={item.id} style={[appStyles.calendarItemChip, typeTileStyle(item.type)]}>
          <Text style={appStyles.calendarItemChipText} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      ))}

      {day.items.length > 2 ? <Text style={appStyles.calendarMore}>+ еще {day.items.length - 2}</Text> : null}
    </Pressable>
  );
});

const WeekDayPill = memo(function WeekDayPill({
  day,
  active,
  onPress,
}: {
  day: {
    key: string;
    date: Date;
  };
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[appStyles.weekDayChip, active && appStyles.weekDayChipActive]}
      onPress={onPress}
    >
      <Text style={[appStyles.weekDayName, active && appStyles.weekDayNameActive]}>
        {day.date.toLocaleString("ru-RU", { weekday: "short" })}
      </Text>
      <Text style={[appStyles.weekDayNumber, active && appStyles.weekDayNumberActive]}>
        {day.date.getDate()}
      </Text>
    </Pressable>
  );
});

const DayDetailCard = memo(function DayDetailCard({
  item,
  onPress,
}: {
  item: LibraryItem;
  onPress: () => void;
}) {
  return (
    <Pressable style={[appStyles.tile, typeTileStyle(item.type)]} onPress={onPress}>
      <View style={appStyles.tileTopRow}>
        <View style={appStyles.typeBadge}>
          <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[item.type]}</Text>
        </View>
        <Text style={appStyles.metaDate}>{formatFullDate(getConsumptionDate(item) as number)}</Text>
      </View>
      <Text style={appStyles.itemTitle}>{item.title}</Text>
      <Text style={appStyles.itemMeta}>{item.authorOrArtist || "без автора"}</Text>
    </Pressable>
  );
});

export function LibraryScreen({
  typeFilter,
  sourceFilter,
  undatedVisibleLibrary,
  timelineSpreading,
  timelinePromptVisible,
  selectedItem,
  visibleLibrary,
  onTypeFilterChange,
  onSourceFilterChange,
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
          <Text style={appStyles.helper}>
            смотри все вместе или раскладывай по типам. в карточках видна дата, чтобы библиотека ощущалась как личная история, а не архив.
          </Text>

          <Text style={appStyles.label}>режим</Text>
          <View style={appStyles.row}>
            <PillButton label="плитки" active={viewMode === "tiles"} onPress={() => setViewMode("tiles")} />
            <PillButton label="календарь" active={viewMode === "calendar"} onPress={() => setViewMode("calendar")} />
          </View>

          <Text style={appStyles.label}>тип контента</Text>
          <View style={appStyles.row}>
            {(["all", "music", "book", "film"] as TypeFilter[]).map((value) => (
              <PillButton
                key={value}
                label={value === "all" ? "все" : TYPE_LABEL[value]}
                active={typeFilter === value}
                onPress={() => onTypeFilterChange(value)}
              />
            ))}
          </View>
        </View>

        {timelinePromptVisible && undatedVisibleLibrary.length > 0 ? (
          <View style={[appStyles.card, appStyles.cardAccentGreen]}>
            <Text style={appStyles.sectionTitle}>когда это было?</Text>
            <Text style={appStyles.helper}>
              мы добавили {undatedVisibleLibrary.length} импортированн{undatedVisibleLibrary.length === 1 ? "ую карточку" : "ых карточек"} без времени. выбери, как это примерно разложить по твоей линии времени.
            </Text>
            <View style={appStyles.row}>
              <PillButton
                label={timelineSpreading ? "раскладываем..." : "это было недавно"}
                onPress={onSpreadThisMonth}
                disabled={timelineSpreading}
              />
              <PillButton label="это было в прошлом месяце" onPress={onSpreadLastMonth} disabled={timelineSpreading} />
              <PillButton label="это было за последние полгода" onPress={onSpreadLast6Months} disabled={timelineSpreading} />
              <PillButton label="это было в этом году" onPress={onSpreadThisYear} disabled={timelineSpreading} />
              <PillButton label="это было очень давно" onPress={onSpreadVeryOld} disabled={timelineSpreading} />
              <PillButton label="разложу потом" onPress={onDismissTimelinePrompt} disabled={timelineSpreading} />
            </View>
          </View>
        ) : null}

        {selectedItem ? (
          <View style={[appStyles.tile, typeTileStyle(selectedItem.type)]}>
            <View style={appStyles.tileTopRow}>
              <View style={appStyles.typeBadge}>
                <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[selectedItem.type]}</Text>
              </View>
              <Text style={appStyles.metaDate}>
                {getConsumptionDate(selectedItem)
                  ? formatFullDate(getConsumptionDate(selectedItem) as number)
                  : "выбери время"}
              </Text>
            </View>
            <Text style={appStyles.itemTitle}>{selectedItem.title}</Text>
            <Text style={appStyles.itemMeta}>{selectedItem.authorOrArtist || "без автора"}</Text>
            {!getConsumptionDate(selectedItem) ? (
              <View style={appStyles.stack}>
                <Text style={appStyles.metaText}>когда это было примерно?</Text>
                <View style={appStyles.row}>
                  <PillButton label="недавно" onPress={onAssignSelectedThisMonth} disabled={timelineSpreading} />
                  <PillButton label="прошлый месяц" onPress={onAssignSelectedLastMonth} disabled={timelineSpreading} />
                  <PillButton label="полгода" onPress={onAssignSelectedLast6Months} disabled={timelineSpreading} />
                  <PillButton label="этот год" onPress={onAssignSelectedThisYear} disabled={timelineSpreading} />
                  <PillButton label="очень давно" onPress={onAssignSelectedVeryOld} disabled={timelineSpreading} />
                </View>
              </View>
            ) : null}
            <PillButton label="редактировать" onPress={() => onEditItem(selectedItem.id)} />
            <PillButton label="удалить" variant="danger" onPress={() => onDeleteItem(selectedItem.id)} />
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
          <Text style={appStyles.metaDate}>
            {getConsumptionDate(item) ? formatFullDate(getConsumptionDate(item) as number) : "без времени"}
          </Text>
        </View>

        <View>
          <Text style={appStyles.itemMeta}>{item.authorOrArtist || TYPE_LABEL[item.type]}</Text>
          <Text style={appStyles.itemTitle}>{item.title}</Text>
        </View>

        {!getConsumptionDate(item) ? (
          <View style={appStyles.row}>
            <PillButton label="недавно" onPress={() => onAssignItemTime(item.id, "this_month")} disabled={timelineSpreading} />
            <PillButton label="месяц" onPress={() => onAssignItemTime(item.id, "last_month")} disabled={timelineSpreading} />
            <PillButton label="полгода" onPress={() => onAssignItemTime(item.id, "last_6_months")} disabled={timelineSpreading} />
          </View>
        ) : null}
      </Pressable>
    );
  }

  function renderCalendarView() {
    return (
      <ScrollView style={appStyles.scroll} contentContainerStyle={appStyles.libraryListContent} showsVerticalScrollIndicator={false}>
        {renderTopCards()}

        <View style={[appStyles.card, appStyles.calendarCard]}>
          <View style={appStyles.calendarTopRow}>
            <Pressable style={appStyles.calendarArrow} onPress={() => setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))}>
              <Text style={appStyles.calendarArrowText}>‹</Text>
            </Pressable>
            <Text style={appStyles.calendarTitle}>
              {calendarMonth
                .toLocaleString("ru-RU", { month: "long", year: "numeric" })
                .replace(/\sг\.$/, "")
                .replace(/^./, (char) => char.toUpperCase())}
            </Text>
            <Pressable style={appStyles.calendarArrow} onPress={() => setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))}>
              <Text style={appStyles.calendarArrowText}>›</Text>
            </Pressable>
          </View>

          <View style={appStyles.calendarWeekdays}>
            {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((label) => (
              <Text key={label} style={appStyles.calendarWeekday}>
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
              <Text style={appStyles.helper}>пока пусто. попробуй импорт из spotify, импорт изображений или загрузку файла.</Text>
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
        <View style={appStyles.dayModalBackdrop}>
          <View style={appStyles.dayModalSheet}>
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
                  <Pressable style={appStyles.dayModalClose} onPress={() => setDayModalVisible(false)}>
                    <Text style={appStyles.dayModalCloseText}>закрыть</Text>
                  </Pressable>
                </View>

                <View style={appStyles.weekStrip}>
                  {selectedWeek.map((day) => (
                    <WeekDayPill
                      key={day.key}
                      day={day}
                      active={day.key === selectedDay.key}
                      onPress={() => setSelectedDayKey(day.key)}
                    />
                  ))}
                </View>

                <ScrollView style={appStyles.dayModalScroll} contentContainerStyle={appStyles.dayModalContent} showsVerticalScrollIndicator={false}>
                  {selectedDay.items.length > 0 ? (
                    selectedDay.items.map((item) => (
                      <DayDetailCard key={item.id} item={item} onPress={() => onSelectItem(item.id)} />
                    ))
                  ) : (
                    <View style={appStyles.card}>
                      <Text style={appStyles.helper}>в этот день пока пусто.</Text>
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
