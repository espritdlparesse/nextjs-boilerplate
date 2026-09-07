import { Image, Text, View } from "react-native";
import { appStyles } from "../styles/appStyles";
import type { getTheme } from "../styles/theme";
import type { useEveryYouApp } from "../hooks/useEveryYouApp";

const SYNC_LABELS = { online: "онлайн", syncing: "обновляем", idle: "офлайн", offline: "офлайн" };

export function AppHeader({ app, theme, compact }: {
  app: ReturnType<typeof useEveryYouApp>;
  theme: ReturnType<typeof getTheme>;
  compact: boolean;
}) {
  return (
    <View style={[appStyles.appHeader, compact && appStyles.appHeaderCompact]}>
      <View style={[appStyles.headerIdentityRow, compact && appStyles.headerIdentityRowCompact]}>
        {app.avatarUri ? (
          <Image
            source={{ uri: app.avatarUri }}
            style={[appStyles.headerAvatarImage, compact && appStyles.headerAvatarImageCompact]}
          />
        ) : (
          <View
            style={[
              appStyles.headerAvatarBubble,
              compact && appStyles.headerAvatarBubbleCompact,
              { backgroundColor: app.themeMode === "dark" ? theme.surfaceMuted : "#F4F4F4", borderColor: theme.border },
            ]}
          >
            <Text style={[appStyles.headerAvatarEmoji, compact && appStyles.headerAvatarEmojiCompact]}>
              {app.headerAvatarEmoji}
            </Text>
          </View>
        )}
        <View style={appStyles.headerIdentityText}>
          <Text style={[appStyles.brand, compact && appStyles.brandCompact, { color: theme.text }]}>everyyou</Text>
          {app.hasCustomName ? (
            <Text style={[appStyles.subtitle, compact && appStyles.subtitleCompact, { color: theme.text }]}>
              привет, {app.displayName.toLowerCase()}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={[appStyles.syncText, compact && appStyles.syncTextCompact, { color: theme.mutedText }]}>
        синхронизация: {SYNC_LABELS[app.syncStatus]} · {app.syncMessage}
      </Text>
    </View>
  );
}
