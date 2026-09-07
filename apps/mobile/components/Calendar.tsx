import { memo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { PillButton } from "./PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { typeTileStyle } from "../styles/typeTileStyle";
import { itemsWord } from "../../../lib/plural";
import { dayKey, startOfMonth } from "../../../lib/dates";
import type { LibraryItem, ThemeMode } from "../shared/everyyou/domain";

export type CalendarDay = {
  key: string;
  date: Date;
  inMonth: boolean;
  items: LibraryItem[];
  steps: number;
};

export const CalendarDayCell = memo(function CalendarDayCell({
  day,
  selected,
  themeMode,
  onPress,
}: {
  day: CalendarDay;
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

const DAY_MONTH = { day: "numeric", month: "long" } as const;

function MoveBanner({ themeMode, title, body, action }: {
  themeMode: ThemeMode;
  title: string;
  body: string;
  action: ReactNode;
}) {
  const theme = getTheme(themeMode);
  return (
    <View style={[appStyles.card, appStyles.calendarMoveBanner, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
      <Text style={[appStyles.sectionTitle, appStyles.calendarMoveTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[appStyles.helper, { color: theme.text }]}>{body}</Text>
      {action}
    </View>
  );
}

export function CalendarBanner({ themeMode, moveMode, selectionCount, onCancelMove, returnDay, lastMovedTargetDay, onJumpBack }: {
  themeMode: ThemeMode;
  moveMode: boolean;
  selectionCount: number;
  onCancelMove: () => void;
  returnDay: CalendarDay | null;
  lastMovedTargetDay: CalendarDay | null;
  onJumpBack: () => void;
}) {
  if (moveMode) {
    return (
      <MoveBanner
        themeMode={themeMode}
        title="выбери новый день"
        body={`переносим ${selectionCount} ${itemsWord(selectionCount)}.`}
        action={<PillButton themeMode={themeMode} label="отмена" onPress={onCancelMove} />}
      />
    );
  }

  if (!returnDay) return null;
  return (
    <MoveBanner
      themeMode={themeMode}
      title={
        lastMovedTargetDay
          ? `перенесли на ${lastMovedTargetDay.date.toLocaleString("ru-RU", DAY_MONTH)}`
          : "дату перенесли"
      }
      body="если хочешь, можно сразу вернуться к прежнему дню."
      action={
        <PillButton
          themeMode={themeMode}
          label={`вернуться к ${returnDay.date.toLocaleString("ru-RU", DAY_MONTH)}`}
          onPress={onJumpBack}
        />
      }
    />
  );
}

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function CalendarMonthGrid({ themeMode, month, onMonthChange, days, selectedKey, onOpenDay, onSelectDayKey }: {
  themeMode: ThemeMode;
  month: Date;
  onMonthChange: (month: Date) => void;
  days: CalendarDay[];
  selectedKey: string | undefined;
  onOpenDay: (key: string) => void;
  onSelectDayKey: (key: string) => void;
}) {
  const theme = getTheme(themeMode);
  const arrowStyle = [appStyles.calendarArrow, themeMode === "dark" && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }];

  function shiftMonth(offset: number) {
    onMonthChange(startOfMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1)));
  }

  return (
    <>
      <View style={appStyles.calendarTopRow}>
        <Pressable style={arrowStyle} onPress={() => shiftMonth(-1)}>
          <Text style={[appStyles.calendarArrowText, { color: theme.text }]}>‹</Text>
        </Pressable>
        <Text style={[appStyles.calendarTitle, { color: theme.text }]}>
          {month
            .toLocaleString("ru-RU", { month: "long", year: "numeric" })
            .replace(/\sг\.$/, "")
            .replace(/^./, (char) => char.toUpperCase())}
        </Text>
        <View style={appStyles.calendarTopActions}>
          <Pressable
            style={[...arrowStyle, appStyles.calendarTodayButton]}
            onPress={() => {
              const today = new Date();
              onMonthChange(startOfMonth(today));
              onSelectDayKey(dayKey(today));
            }}
          >
            <Text style={[appStyles.calendarTodayText, { color: theme.text }]}>сегодня</Text>
          </Pressable>
          <Pressable style={arrowStyle} onPress={() => shiftMonth(1)}>
            <Text style={[appStyles.calendarArrowText, { color: theme.text }]}>›</Text>
          </Pressable>
        </View>
      </View>

      <View style={appStyles.calendarWeekdays}>
        {WEEKDAYS.map((label) => (
          <Text key={label} style={[appStyles.calendarWeekday, { color: theme.mutedText }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={appStyles.calendarGrid}>
        {days.map((day) => (
          <CalendarDayCell
            key={day.key}
            day={day}
            selected={day.key === selectedKey}
            themeMode={themeMode}
            onPress={() => onOpenDay(day.key)}
          />
        ))}
      </View>
    </>
  );
}

export function MonthLevelCard({ themeMode, count, onPress }: {
  themeMode: ThemeMode;
  count: number;
  onPress: () => void;
}) {
  const theme = getTheme(themeMode);
  const isDark = themeMode === "dark";
  if (count === 0) return null;

  return (
    <Pressable
      style={[
        appStyles.card,
        appStyles.monthLevelCard,
        appStyles.cardAccentYellow,
        isDark && { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
      onPress={onPress}
    >
      <View style={appStyles.monthLevelTopRow}>
        <View style={appStyles.monthLevelTextBlock}>
          <Text style={appStyles.monthLevelTitle}>а еще в этом месяце было</Text>
          <Text style={[appStyles.helper, appStyles.monthLevelBody, { color: theme.text }]}>
            {count} {itemsWord(count)} без точного дня.
          </Text>
        </View>
        <View style={[appStyles.statusChip, isDark && { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
          <Text style={[appStyles.statusChipText, { color: isDark ? theme.text : undefined }]}>{count}</Text>
        </View>
      </View>
      <Text style={[appStyles.metaText, { color: isDark ? theme.mutedText : undefined }]}>нажми, чтобы открыть список</Text>
    </Pressable>
  );
}
