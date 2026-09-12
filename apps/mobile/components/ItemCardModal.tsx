import { Modal, Pressable, Text, View } from "react-native";
import { PillButton } from "./PillButton";
import { TimelinePresetPills } from "./TimelinePresetPills";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { typeTileStyle } from "../styles/typeTileStyle";

import {
  formatFullDate,
  getConsumptionDate,
  getTimeOriginLabel,
  TYPE_LABEL,
  type LibraryItem,
  type ThemeMode,
} from "../shared/everyyou/domain";
import type { TimelineSpreadPreset } from "../hooks/timelineTypes";

export function ItemCardModal({ item, themeMode, timelineSpreading, onClose, onAssignSelected, onEditItem, onDeleteItem }: {
  item: LibraryItem | null;
  themeMode: ThemeMode;
  timelineSpreading: boolean;
  onClose: () => void;
  onAssignSelected: (preset: TimelineSpreadPreset) => void;
  onEditItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
}) {
  const theme = getTheme(themeMode);
  return (
    <Modal visible={Boolean(item)} transparent animationType="fade" onRequestClose={onClose}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.guideModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            {item ? (
              <>
                <View style={appStyles.dayModalTopRow}>
                  <View style={appStyles.dayModalHeading}>
                    <Text style={[appStyles.sectionTitle, { color: theme.text }]}>карточка</Text>
                  </View>
                  <Pressable style={[appStyles.modalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]} onPress={() => onClose()}>
                    <Text style={[appStyles.modalCloseText, { color: theme.text }]}>×</Text>
                  </Pressable>
                </View>
                <View style={[appStyles.tile, typeTileStyle(item.type)]}>
                  <View style={appStyles.tileTopRow}>
                    <View style={appStyles.typeBadge}>
                      <Text style={appStyles.typeBadgeText}>{TYPE_LABEL[item.type]}</Text>
                    </View>
                    <Text style={[appStyles.metaDate, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
                      {getConsumptionDate(item)
                        ? formatFullDate(getConsumptionDate(item) as number)
                        : "выбери время"}
                    </Text>
                  </View>
                  <Text style={appStyles.itemTitle}>{item.title}</Text>
                  <Text style={appStyles.itemMeta}>{item.authorOrArtist || "без автора"}</Text>
                  {getTimeOriginLabel(item.timeOrigin) ? (
                    <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentMutedText : undefined }]}>
                      {getTimeOriginLabel(item.timeOrigin)}
                    </Text>
                  ) : null}
                  {!getConsumptionDate(item) ? (
                    <View style={appStyles.stack}>
                      <Text style={[appStyles.metaText, { color: themeMode === "dark" ? theme.accentMutedText : theme.mutedText }]}>когда это было примерно?</Text>
                      <TimelinePresetPills themeMode={themeMode} disabled={timelineSpreading} onPress={onAssignSelected} />
                    </View>
                  ) : null}
                </View>
                <View style={appStyles.dayActionRow}>
                  <PillButton themeMode={themeMode} style={appStyles.dayActionPill} label="редактировать" onPress={() => onEditItem(item.id)} />
                  <PillButton themeMode={themeMode} style={appStyles.dayActionPill} label="удалить" variant="danger" onPress={() => onDeleteItem(item.id)} />
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
  );
}
