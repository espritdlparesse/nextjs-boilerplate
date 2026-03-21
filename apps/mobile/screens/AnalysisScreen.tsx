import { Text, View } from "react-native";
import { formatFullDate, type AnalysisRun, type ContentType } from "../shared/everyyou/domain";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";

type AnalysisScreenProps = {
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
  counters,
  analysisRunning,
  analysisResult,
  analysisHistory,
  onRunPress,
  onOpenResult,
}: AnalysisScreenProps) {
  return (
    <View style={appStyles.screen}>
      <View style={[appStyles.sectionHero, appStyles.sectionHeroAlt]}>
        <Text style={appStyles.sectionTitle}>вайбчек</Text>
        <Text style={appStyles.helper}>
          сейчас в библиотеке {counters.total}: музыка {counters.byType.music}, книги {counters.byType.book}, фильмы{" "}
          {counters.byType.film}.
        </Text>
        <Text style={appStyles.metaText}>здесь должен быть не сухой summary, а короткая прожарка вкуса с наблюдениями, паттернами и нормальными реками.</Text>
        <PillButton
          label={analysisRunning ? "думаем..." : "провести вайбчек"}
          variant="primary"
          disabled={analysisRunning}
          onPress={onRunPress}
        />
      </View>

      {analysisResult ? (
        <View style={[appStyles.tile, appStyles.tilePink]}>
          <Text style={appStyles.itemTitle}>свежая прожарка</Text>
          <Text style={appStyles.helper}>{analysisResult.summary}</Text>
          {analysisResult.highlights.map((item) => (
            <Text key={item} style={appStyles.metaText}>
              • {item}
            </Text>
          ))}
          <Text style={appStyles.metaDate}>{formatFullDate(analysisResult.createdAt)}</Text>
        </View>
      ) : null}

      {analysisHistory.length > 0 ? (
        <View style={appStyles.stack}>
          {analysisHistory.map((item) => (
            <View key={item.id} style={[appStyles.tile, appStyles.tileYellow]}>
              <Text style={appStyles.itemTitle}>{item.itemCount} айтемов</Text>
              <Text style={appStyles.helper}>{item.summary}</Text>
              <Text style={appStyles.metaDate}>{formatFullDate(item.createdAt)}</Text>
              <PillButton label="открыть" onPress={() => onOpenResult(item)} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
