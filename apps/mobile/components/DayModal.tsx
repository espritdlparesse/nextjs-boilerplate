import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { PillButton } from "./PillButton";
import { DayDetailCard, WeekDayPill, reactItemKey } from "./dayCards";
import type { CalendarDay } from "./Calendar";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { TYPE_LABEL, type ContentType, type LibraryItem, type ThemeMode } from "../shared/everyyou/domain";

type DayTypeFilter = ContentType | "all";

export function DayModal({
  visible,
  day,
  week,
  items,
  counts,
  typeFilter,
  selection,
  healthStepsEnabled,
  themeMode,
  onClose,
  onSelectDayKey,
  onTypeFilterChange,
  onToggleSelection,
  onClearSelection,
  onStartMove,
}: {
  visible: boolean;
  day: Omit<CalendarDay, "inMonth"> | null;
  week: Array<Omit<CalendarDay, "inMonth">>;
  items: LibraryItem[];
  counts: Record<string, number>;
  typeFilter: DayTypeFilter;
  selection: string[];
  healthStepsEnabled: boolean;
  themeMode: ThemeMode;
  onClose: () => void;
  onSelectDayKey: (key: string) => void;
  onTypeFilterChange: (value: DayTypeFilter) => void;
  onToggleSelection: (id: string) => void;
  onClearSelection: () => void;
  onStartMove: () => void;
}) {
  const theme = getTheme(themeMode);
  return (
      <Modal visible={visible && Boolean(day)} transparent animationType="fade" onRequestClose={onClose}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.dayModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {day ? (
              <>
                <View style={appStyles.dayModalTopRow}>
                  <View style={appStyles.dayModalHeading}>
                    <Text style={[appStyles.sectionTitle, appStyles.dayModalTitle, { color: theme.text }]}>
                      {day.date
                        .toLocaleString("ru-RU", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                        .replace(/^./, (char) => char.toUpperCase())}
                    </Text>
                  </View>
                  <Pressable style={[appStyles.modalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => onClose()}>
                    <Text style={[appStyles.modalCloseText, { color: theme.text }]}>×</Text>
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
                  {week.map((dayEntry) => (
                    <WeekDayPill
                      key={day.key}
                      day={day}
                      active={dayEntry.key === day.key}
                      themeMode={themeMode}
                      onPress={() => onSelectDayKey(dayEntry.key)}
                    />
                  ))}
                </ScrollView>

                {healthStepsEnabled && day.steps > 0 ? (
                  <View style={[appStyles.card, appStyles.dayStepsCard, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    <Text style={[appStyles.dayStepsTitle, { color: theme.text }]}>шаги</Text>
                    <Text style={[appStyles.dayStepsValue, { color: theme.text }]}>
                      {day.steps.toLocaleString("ru-RU")}
                    </Text>
                    <Text style={[appStyles.metaText, { color: theme.mutedText }]}>из приложения «здоровье», когда подключим интеграцию</Text>
                  </View>
                ) : null}

                <View style={appStyles.dayTypeFilterRow}>
                  {(["all", "music", "book", "movie"] as DayTypeFilter[]).map((value) => (
                    <PillButton
                      key={value}
                      themeMode={themeMode}
                      style={appStyles.dayTypeFilterPill}
                      label={
                        value === "all"
                          ? `все ${counts.all}`
                          : `${TYPE_LABEL[value]} ${counts[value]}`
                      }
                      active={typeFilter === value}
                      onPress={() => onTypeFilterChange(value)}
                    />
                  ))}
                </View>

                <FlatList
                  key={`${day.key}-${typeFilter}`}
                  data={items}
                  numColumns={3}
                  keyExtractor={(item, index) => reactItemKey(item, index)}
                  renderItem={({ item }) => (
                    <Pressable style={appStyles.dayGridPressable} onPress={() => onToggleSelection(item.id)}>
                      <DayDetailCard item={item} themeMode={themeMode} onPress={() => onToggleSelection(item.id)} />
                      {selection.includes(item.id) ? (
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
                        {typeFilter === "all" ? "в этот день пока пусто." : "в этот день пока ничего не было в этой категории."}
                      </Text>
                    </View>
                  }
                  ListHeaderComponent={
                    selection.length > 0 ? (
                      <View style={appStyles.dayActionRow}>
                        <PillButton
                          themeMode={themeMode}
                          style={appStyles.dayActionPill}
                          label={selection.length === 1 ? "изменить дату" : `изменить дату (${selection.length})`}
                          onPress={onStartMove}
                        />
                        <PillButton
                          themeMode={themeMode}
                          style={appStyles.dayActionPill}
                          label="снять выбор"
                          onPress={() => onClearSelection()}
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
  );
}
