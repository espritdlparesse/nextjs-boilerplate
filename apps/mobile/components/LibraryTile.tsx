import { Pressable, Text, View } from "react-native";
import { TYPE_LABEL, formatFullDate, getConsumptionDate, getTimeOriginLabel, type LibraryItem, type ThemeMode } from "../shared/everyyou/domain";
import { PillButton } from "./PillButton";
import type { TimelineSpreadPreset } from "../hooks/timelineTypes";
import { appStyles } from "../styles/appStyles";
import { typeTileStyle } from "../styles/typeTileStyle";

export function LibraryTile({ item, theme, themeMode, onSelectItem, onAssignItemTime, timelineSpreading }: {
  item: LibraryItem;
  theme: ReturnType<typeof import("../styles/theme").getTheme>;
  themeMode: ThemeMode;
  onSelectItem: (id: string | null) => void;
  onAssignItemTime: (id: string, preset: TimelineSpreadPreset) => void;
  timelineSpreading: boolean;
}) {
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
  )
}
