import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { typeTileStyle } from "../styles/typeTileStyle";

import {
  getConsumptionDate,
  getTimeOriginLabel,
  TYPE_LABEL,
  type LibraryItem,
  type ThemeMode,
} from "../shared/everyyou/domain";

export function reactItemKey(item: LibraryItem, index: number) {
  return `${item.id}-${item.consumedAt ?? item.createdAt ?? "nodate"}-${index}`;
}

export const WeekDayPill = memo(function WeekDayPill({
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

export const DayDetailCard = memo(function DayDetailCard({
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

