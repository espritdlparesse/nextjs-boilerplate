import { Pressable, Text, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { dayKey } from "../../../lib/dates";
import type { ThemeMode } from "../shared/everyyou/domain";

export const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export type RangeDay = { key: string; date: Date; inMonth: boolean; count: number };

type Placement = { inRange: boolean; isEdge: boolean };

function placeInRange(date: Date, range: { from: number; to: number } | null): Placement {
  if (!range) return { inRange: false, isEdge: false };
  const start = new Date(range.from);
  const end = new Date(range.to);
  const isEdge = dayKey(date) === dayKey(start) || dayKey(date) === dayKey(end);
  const inRange = date.getTime() >= range.from && date.getTime() <= range.to;
  return { inRange, isEdge };
}

function RangeDayCell({ day, range, themeMode, onPress }: {
  day: RangeDay;
  range: { from: number; to: number } | null;
  themeMode: ThemeMode;
  onPress: () => void;
}) {
  const theme = getTheme(themeMode);
  const { inRange, isEdge } = placeInRange(day.date, range);
  const bandColor = themeMode === "dark" ? "#214A33" : "#DFF7D8";
  const numberColor = isEdge ? theme.buttonPrimaryText : day.inMonth ? theme.text : theme.quietText;

  return (
    <Pressable
      style={[
        appStyles.calendarDay,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
        !day.inMonth && appStyles.calendarDayMuted,
        inRange && !isEdge && { backgroundColor: bandColor, borderColor: bandColor },
        isEdge && { backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBg },
      ]}
      onPress={onPress}
    >
      <View style={appStyles.calendarDayHead}>
        <Text style={[appStyles.calendarDayNumber, { color: numberColor }]}>{day.date.getDate()}</Text>
        {day.count > 0 ? (
          <Text
            style={[appStyles.calendarDayCount, { color: isEdge ? theme.buttonPrimaryText : theme.mutedText }]}
          >
            {day.count}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export function RangeMonthBlock({ days, month, range, themeMode, onPressDay }: {
  days: RangeDay[];
  month: Date;
  range: { from: number; to: number } | null;
  themeMode: ThemeMode;
  onPressDay: (key: string) => void;
}) {
  const theme = getTheme(themeMode);
  return (
    <View style={appStyles.stack}>
      <Text style={[appStyles.sectionTitle, { color: theme.text }]}>
        {month.toLocaleString("ru-RU", { month: "long" }).replace(/^./, (char) => char.toUpperCase())}
      </Text>
      <View style={appStyles.calendarWeekdays}>
        {WEEKDAYS.map((label) => (
          <Text key={`${month.getMonth()}-${label}`} style={[appStyles.calendarWeekday, { color: theme.mutedText }]}>
            {label}
          </Text>
        ))}
      </View>
      <View style={appStyles.calendarGrid}>
        {days.map((day) => (
          <RangeDayCell
            key={day.key}
            day={day}
            range={range}
            themeMode={themeMode}
            onPress={() => onPressDay(day.key)}
          />
        ))}
      </View>
    </View>
  );
}
