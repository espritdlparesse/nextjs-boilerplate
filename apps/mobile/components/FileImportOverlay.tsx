import { Pressable, Text, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import type { getTheme } from "../styles/theme";

export function FileImportOverlay({ visible, canCancel, theme, onCancel }: {
  visible: boolean;
  canCancel: boolean;
  theme: ReturnType<typeof getTheme>;
  onCancel: () => void;
}) {
  if (!visible) return null;
  return (
    <View style={[appStyles.busyOverlay, { backgroundColor: theme.overlay }]}>
      <View style={[appStyles.busyOverlayCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[appStyles.busyOverlayTitle, { color: theme.text }]}>открываем файлы...</Text>
        <Text style={[appStyles.busyOverlayText, { color: theme.mutedText }]}>это может занять несколько секунд</Text>
        {canCancel ? (
          <Pressable
            style={[appStyles.modalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
            onPress={onCancel}
          >
            <Text style={[appStyles.modalCloseText, { color: theme.text }]}>×</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
