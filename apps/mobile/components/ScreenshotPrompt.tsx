import { Pressable, Text, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import type { getTheme } from "../styles/theme";

export function ScreenshotPrompt({ visible, theme, status, loading, onShare, onDismiss }: {
  visible: boolean;
  theme: ReturnType<typeof getTheme>;
  status: string | null;
  loading: boolean;
  onShare: () => void;
  onDismiss: () => void;
}) {
  if (!visible) return null;
  return (
          <View style={[appStyles.screenshotSheetWrap, { backgroundColor: theme.overlay }]}>
            <View
              style={[
                appStyles.screenshotSheet,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={appStyles.screenshotSheetTop}>
                <View style={appStyles.screenshotSheetHeading}>
                  <Text style={[appStyles.screenshotSheetTitle, { color: theme.text }]}>
                    скриншот готов
                  </Text>
                </View>
                <Pressable
                  style={[
                    appStyles.dayModalClose,
                    { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  ]}
                  onPress={() => {
                    onDismiss();
                  }}
                >
                  <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>не сейчас</Text>
                </Pressable>
              </View>

              <View style={appStyles.row}>
                <Pressable
                  style={[
                    appStyles.pillButton,
                    appStyles.primaryButton,
                    appStyles.screenshotActionButtonSingle,
                    loading && appStyles.disabledButton,
                    { backgroundColor: theme.buttonPrimaryBg, borderColor: theme.buttonPrimaryBorder },
                  ]}
                  disabled={loading}
                  onPress={onShare}
                >
                  <Text style={[appStyles.primaryText, { color: theme.buttonPrimaryText }]}>
                    {loading ? "готовим..." : "поделиться"}
                  </Text>
                </Pressable>
              </View>

              <Text style={[appStyles.screenshotSheetMeta, { color: theme.mutedText }]}>
                можно отправить в Telegram, Instagram или куда угодно еще
              </Text>
              {status ? (
                <Text style={[appStyles.screenshotSheetStatus, { color: theme.mutedText }]}>
                  {status}
                </Text>
              ) : null}
            </View>
          </View>
  );
}
