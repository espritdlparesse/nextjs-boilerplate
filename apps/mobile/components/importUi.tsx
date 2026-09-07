import { Pressable, Text, View } from "react-native";
import { BrandLogo } from "./BrandLogo";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import { type ThemeMode } from "../shared/everyyou/domain";
import type { GuideKey } from "./importGuides";

export function BrandImportButton({
  brand,
  hint,
  onPress,
  onHelpPress,
  themeMode,
}: {
  brand: Exclude<GuideKey, null>;
  hint: string;
  onPress: () => void;
  onHelpPress: () => void;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  return (
    <View style={[appStyles.brandButton, { backgroundColor: theme.brandButtonBg, borderColor: theme.brandButtonBorder }]}>
      <Pressable style={appStyles.brandHelpButton} onPress={onHelpPress}>
        <Text style={[appStyles.brandHelpButtonText, { color: theme.brandHintText }]}>?</Text>
      </Pressable>
      <Pressable style={appStyles.brandButtonMain} onPress={onPress}>
        <BrandLogo brand={brand} />
        <Text style={[appStyles.brandHint, { color: theme.brandHintText }]}>{hint}</Text>
      </Pressable>
    </View>
  );
}

export function StatusChip({ text }: { text: string }) {
  return (
    <View style={appStyles.statusChip}>
      <Text style={appStyles.statusChipText}>{text}</Text>
    </View>
  );
}

export function DateInsightBlock({ insight }: { insight: { title: string; body: string; meta?: string } }) {
  return (
    <View style={appStyles.dateInsightCard}>
      <Text style={appStyles.dateInsightTitle}>{insight.title}</Text>
      <Text style={appStyles.dateInsightBody}>{insight.body}</Text>
      {insight.meta ? <Text style={appStyles.metaText}>{insight.meta}</Text> : null}
    </View>
  );
}

export function ImportStatusBlock({
  title,
  body,
  themeMode,
}: {
  title: string;
  body: string;
  themeMode: ThemeMode;
}) {
  const theme = getTheme(themeMode);
  return (
    <View
      style={[
        appStyles.importStatusCard,
        {
          backgroundColor: themeMode === "dark" ? theme.surfaceMuted : "#FFFFFF",
          borderColor: theme.border,
        },
      ]}
    >
      <Text style={[appStyles.importStatusTitle, { color: theme.text }]}>{title}</Text>
      <Text style={[appStyles.importStatusBody, { color: theme.mutedText }]}>{body}</Text>
    </View>
  );
}

