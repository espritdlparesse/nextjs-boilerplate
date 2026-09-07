import { Pressable, Text, TextInput, View } from "react-native";
import { PillButton } from "./PillButton";
import { TimelinePresetPills } from "./TimelinePresetPills";
import { DateInsightBlock, ImportStatusBlock, StatusChip } from "./importUi";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { TYPE_LABEL, type ContentType, type ThemeMode } from "../shared/everyyou/domain";
import type { PendingImageItem } from "../hooks/importTypes";
import type { DateInsight, TimelineSpreadPreset } from "../hooks/timelineTypes";

export function ScreenshotImportCard({
  themeMode,
  isScreenshotImporting,
  importedCount,
  screenshotStatus,
  screenshotDateInsight,
  pendingImageItems,
  selectedPendingImageItem,
  confirmingPendingImageImport,
  onScreenshotImportPress,
  onConfirmPendingImageImport,
  onCancelPendingImageImport,
  onRemovePendingImageItem,
  onSelectPendingImageItem,
  onUpdatePendingImageItem,
  onAssignPendingImageItem,
}: {
  themeMode: ThemeMode;
  isScreenshotImporting: boolean;
  importedCount: number;
  screenshotStatus: string | null;
  screenshotDateInsight: DateInsight | null;
  pendingImageItems: PendingImageItem[];
  selectedPendingImageItem: PendingImageItem | null;
  confirmingPendingImageImport: boolean;
  onScreenshotImportPress: () => void;
  onConfirmPendingImageImport: () => void;
  onCancelPendingImageImport: () => void;
  onRemovePendingImageItem: (id: string) => void;
  onSelectPendingImageItem: (id: string | null) => void;
  onUpdatePendingImageItem: (id: string, patch: Partial<PendingImageItem>) => void;
  onAssignPendingImageItem: (id: string, preset: TimelineSpreadPreset) => void;
}) {
  const theme = getTheme(themeMode);
  const saveRow = (
    <View style={appStyles.row}>
      <PillButton
        label={confirmingPendingImageImport ? "сохраняем..." : `сохранить ${pendingImageItems.length}`}
        variant="primary"
        themeMode={themeMode}
        disabled={confirmingPendingImageImport}
        onPress={onConfirmPendingImageImport}
      />
      <PillButton
        label="отмена"
        themeMode={themeMode}
        disabled={confirmingPendingImageImport}
        onPress={onCancelPendingImageImport}
      />
    </View>
  );

  return (
      <View style={[appStyles.card, themeMode === "dark" ? { backgroundColor: theme.accentPink, borderColor: theme.border } : appStyles.cardAccentPink]}>
        <Text style={appStyles.sectionTitle}>добавить</Text>
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          {pendingImageItems.length > 0
            ? "ткни на карточку, если хочешь поправить ее до сохранения."
            : "кидай скриншоты откуда угодно, фото книжной полки, обложки в магазине или добавляй вручную. мы попробуем собрать это в один культурный таймлайн."}
        </Text>
        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          подойдут и скриншоты сервисов, и фото твоей книжной полки, и просто обложки книг, альбомов или постеров.
        </Text>

        <PillButton
          label={isScreenshotImporting ? "анализируем изображения..." : "загрузить изображения"}
          onPress={onScreenshotImportPress}
          themeMode={themeMode}
          disabled={isScreenshotImporting}
        />

        {screenshotStatus ? (
          <ImportStatusBlock title="что сейчас происходит" body={screenshotStatus} themeMode={themeMode} />
        ) : null}

        <View style={appStyles.chipRow}>
          <StatusChip text={`импортировано: ${importedCount} треков`} />
        </View>
        {screenshotDateInsight ? <DateInsightBlock insight={screenshotDateInsight} /> : null}

        {pendingImageItems.length > 0 ? (
          <View style={appStyles.stack}>
            {saveRow}
            <View style={appStyles.previewGrid}>
              {pendingImageItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={[
                    appStyles.tile,
                    appStyles.previewTile,
                    appStyles.tileYellow,
                    selectedPendingImageItem?.id === item.id && appStyles.previewTileActive,
                  ]}
                  onPress={() => onSelectPendingImageItem(item.id)}
                >
                  <Text style={appStyles.previewType}>{TYPE_LABEL[item.type]}</Text>
                  <Text style={appStyles.previewTitle}>{item.title}</Text>
                  <Text style={appStyles.previewMeta}>{item.authorOrArtist}</Text>
                  <Pressable style={appStyles.previewRemoveChip} onPress={() => onRemovePendingImageItem(item.id)}>
                    <Text style={appStyles.previewRemoveChipText}>убрать</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
            {selectedPendingImageItem ? (
              <View style={[appStyles.instructionCard, appStyles.compactEditorCard, themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Text style={appStyles.editorTitle}>поправить карточку</Text>
                <View style={appStyles.row}>
                  {(["music", "book", "movie"] as ContentType[]).map((value) => (
                    <PillButton
                      key={value}
                      label={TYPE_LABEL[value]}
                      active={selectedPendingImageItem.type === value}
                      themeMode={themeMode}
                      onPress={() =>
                        onUpdatePendingImageItem(selectedPendingImageItem.id, { type: value })
                      }
                    />
                  ))}
                </View>
                <TextInput
                  style={[appStyles.input, appStyles.compactInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                  placeholder="название"
                  placeholderTextColor={theme.inputPlaceholder}
                  value={selectedPendingImageItem.title}
                  onChangeText={(value) =>
                    onUpdatePendingImageItem(selectedPendingImageItem.id, { title: value })
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TextInput
                  style={[appStyles.input, appStyles.compactInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
                  placeholder="автор, артист или режиссер"
                  placeholderTextColor={theme.inputPlaceholder}
                  value={selectedPendingImageItem.authorOrArtist}
                  onChangeText={(value) =>
                    onUpdatePendingImageItem(selectedPendingImageItem.id, { authorOrArtist: value })
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={[appStyles.metaText, { color: theme.mutedText }]}>когда это было примерно?</Text>
                <TimelinePresetPills
                  themeMode={themeMode}
                  onPress={(preset) => onAssignPendingImageItem(selectedPendingImageItem.id, preset)}
                />
              </View>
            ) : null}
            {saveRow}
          </View>
        ) : null}
      </View>
  );
}
