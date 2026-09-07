import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PillButton } from "./PillButton";
import { TimelinePresetPills } from "./TimelinePresetPills";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { TYPE_LABEL, type LibraryItem, type ThemeMode } from "../shared/everyyou/domain";
import type { TimeQualityFilter, TypeFilter } from "../hooks/appTypes";
import type { TimelineSpreadPreset } from "../hooks/timelineTypes";

export type LibraryViewMode = "tiles" | "calendar";

const TYPE_OPTIONS: [TypeFilter, string][] = [
  ["all", "все"],
  ["music", TYPE_LABEL.music],
  ["book", TYPE_LABEL.book],
  ["movie", TYPE_LABEL.movie],
];

const TIME_QUALITY_OPTIONS: [TimeQualityFilter, string][] = [
  ["all", "все"],
  ["exact", "точный день"],
  ["imported", "дата из сервиса"],
  ["estimated", "разложили вручную"],
  ["undated", "пока без даты"],
];

function labelOf<Value extends string>(options: [Value, string][], value: Value) {
  return options.find(([option]) => option === value)?.[1] ?? "все";
}

function FilterAccordion<Value extends string>({ themeMode, title, options, value, onChange }: {
  themeMode: ThemeMode;
  title: string;
  options: [Value, string][];
  value: Value;
  onChange: (value: Value) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const theme = getTheme(themeMode);
  const mutedColor = themeMode === "dark" ? theme.accentMutedText : undefined;

  return (
    <View style={appStyles.compactFilterSection}>
      <Pressable style={appStyles.compactAccordionHeader} onPress={() => setExpanded((current) => !current)}>
        <Text style={[appStyles.compactFilterHeader, { color: mutedColor }]}>{title}</Text>
        <View style={appStyles.compactAccordionMeta}>
          <Text style={[appStyles.compactAccordionValue, { color: mutedColor }]}>{labelOf(options, value)}</Text>
          <Text style={[appStyles.compactAccordionChevron, { color: mutedColor }]}>{expanded ? "−" : "+"}</Text>
        </View>
      </Pressable>
      {expanded ? (
        <View style={appStyles.compactFilterRow}>
          {options.map(([option, label]) => (
            <PillButton
              key={option}
              themeMode={themeMode}
              style={appStyles.compactPillButton}
              label={label}
              active={value === option}
              onPress={() => onChange(option)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LibraryFilters({
  themeMode,
  viewMode,
  onViewModeChange,
  typeFilter,
  onTypeFilterChange,
  timeQualityFilter,
  onTimeQualityFilterChange,
  timelinePromptVisible,
  undatedVisibleLibrary,
  timelineSpreading,
  onSpread,
  onDismissTimelinePrompt,
}: {
  themeMode: ThemeMode;
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
  typeFilter: TypeFilter;
  onTypeFilterChange: (value: TypeFilter) => void;
  timeQualityFilter: TimeQualityFilter;
  onTimeQualityFilterChange: (value: TimeQualityFilter) => void;
  timelinePromptVisible: boolean;
  undatedVisibleLibrary: LibraryItem[];
  timelineSpreading: boolean;
  onSpread: (preset: TimelineSpreadPreset) => void;
  onDismissTimelinePrompt: () => void;
}) {
  const theme = getTheme(themeMode);
  const isDark = themeMode === "dark";
  const undatedCount = undatedVisibleLibrary.length;

  return (
    <View style={appStyles.libraryListTop}>
      <View style={[appStyles.card, appStyles.cardAccentPink, appStyles.libraryTopCompactCard]}>
        <Text style={appStyles.sectionTitle}>библиотека</Text>
        <View style={appStyles.compactFilterSection}>
          <Text style={[appStyles.compactFilterHeader, { color: isDark ? theme.accentMutedText : undefined }]}>отображение</Text>
          <View style={appStyles.compactFilterRow}>
            <PillButton
              themeMode={themeMode}
              style={appStyles.compactPillButton}
              label="плитки"
              active={viewMode === "tiles"}
              onPress={() => onViewModeChange("tiles")}
            />
            <PillButton
              themeMode={themeMode}
              style={appStyles.compactPillButton}
              label="календарь"
              active={viewMode === "calendar"}
              onPress={() => onViewModeChange("calendar")}
            />
          </View>
        </View>

        <Text style={[appStyles.helper, appStyles.libraryIntroCompact, { color: isDark ? theme.accentText : theme.text }]}>
          смотри все вместе или раскладывай по типам и по тому, как проставлены даты.
        </Text>

        <FilterAccordion
          themeMode={themeMode}
          title="тип контента"
          options={TYPE_OPTIONS}
          value={typeFilter}
          onChange={onTypeFilterChange}
        />
        <FilterAccordion
          themeMode={themeMode}
          title="как проставлена дата"
          options={TIME_QUALITY_OPTIONS}
          value={timeQualityFilter}
          onChange={onTimeQualityFilterChange}
        />
      </View>

      {timelinePromptVisible && undatedCount > 0 ? (
        <View style={[appStyles.card, isDark ? { backgroundColor: theme.accentGreen, borderColor: theme.border } : appStyles.cardAccentGreen]}>
          <Text style={appStyles.sectionTitle}>когда это было?</Text>
          <Text style={[appStyles.helper, { color: isDark ? theme.accentText : theme.text }]}>
            мы добавили {undatedCount} импортированн{undatedCount === 1 ? "ую карточку" : "ых карточек"} без времени. выбери, как это примерно разложить по твоей линии времени.
          </Text>
          <TimelinePresetPills
            themeMode={themeMode}
            wording="sentence"
            disabled={timelineSpreading}
            firstLabel={timelineSpreading ? "раскладываем..." : undefined}
            onPress={onSpread}
          >
            <PillButton themeMode={themeMode} label="разложу потом" onPress={onDismissTimelinePrompt} disabled={timelineSpreading} />
          </TimelinePresetPills>
        </View>
      ) : null}
    </View>
  );
}
