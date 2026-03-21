import { Text, View } from "react-native";
import { formatFullDate, type AnalysisRun, type ContentType, type ThemeMode } from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";

type AnalysisScreenProps = {
  themeMode: ThemeMode;
  counters: {
    total: number;
    byType: Record<ContentType, number>;
  };
  analysisRunning: boolean;
  analysisResult: AnalysisRun | null;
  analysisHistory: AnalysisRun[];
  onRunPress: () => void;
  onOpenResult: (run: AnalysisRun) => void;
};

export function AnalysisScreen({
  themeMode,
  counters,
  analysisRunning,
  analysisResult,
  analysisHistory,
  onRunPress,
  onOpenResult,
}: AnalysisScreenProps) {
  const theme = getTheme(themeMode);
  return (
    <View style={appStyles.screen}>
      <View
        style={[
          appStyles.sectionHero,
          appStyles.sectionHeroAlt,
          themeMode === "dark" && { backgroundColor: theme.accentBlue, borderColor: theme.border },
        ]}
      >
        <Text style={appStyles.sectionTitle}>вайбчек</Text>
        <Text style={appStyles.helper}>
          сейчас в библиотеке {counters.total}: музыка {counters.byType.music}, книги {counters.byType.book}, фильмы{" "}
          {counters.byType.film}.
        </Text>
        <Text style={appStyles.metaText}>здесь должен быть не сухой summary, а короткая прожарка вкуса с наблюдениями, паттернами и нормальными реками.</Text>
        <PillButton
          label={analysisRunning ? "думаем..." : "провести вайбчек"}
          variant="primary"
          themeMode={themeMode}
          disabled={analysisRunning}
          onPress={onRunPress}
        />
      </View>

      {analysisResult ? (
        <View style={[appStyles.tile, themeMode === "dark" ? { backgroundColor: theme.accentPink, borderColor: theme.border } : appStyles.tilePink]}>
          <Text style={appStyles.itemTitle}>свежая прожарка</Text>
          <Text style={[appStyles.helper, { color: theme.text }]}>{analysisResult.summary}</Text>
          {analysisResult.highlights.map((item) => (
            <Text key={item} style={[appStyles.metaText, { color: theme.mutedText }]}>
              • {item}
            </Text>
          ))}
          <Text style={[appStyles.metaDate, { color: theme.quietText }]}>{formatFullDate(analysisResult.createdAt)}</Text>
        </View>
      ) : null}
    </View>
  );
}
