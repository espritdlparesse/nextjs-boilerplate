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
  deepAnalysisRunning: boolean;
  deepAnalysisAccess: "free" | "paywall";
  deepAnalysisUsesLeft: number;
  deepAnalysisTotalFreeUses: number;
  deepAnalysisResult: AnalysisRun | null;
  onRunPress: () => void;
  onRunDeepPress: () => void;
};

export function AnalysisScreen({
  themeMode,
  counters,
  analysisRunning,
  analysisResult,
  deepAnalysisRunning,
  deepAnalysisAccess,
  deepAnalysisUsesLeft,
  deepAnalysisTotalFreeUses,
  deepAnalysisResult,
  onRunPress,
  onRunDeepPress,
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
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          сейчас в библиотеке {counters.total}: музыка {counters.byType.music}, книги {counters.byType.book}, фильмы{" "}
          {counters.byType.film}.
        </Text>
        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          быстрый вайбчек — это короткая прожарка вкуса, без глубокого анализа состояния.
        </Text>
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
          <Text style={[appStyles.helper, { color: theme.accentText }]}>{analysisResult.summary}</Text>
          {analysisResult.highlights.map((item) => (
            <Text key={item} style={[appStyles.metaText, { color: theme.accentMutedText }]}>
              • {item}
            </Text>
          ))}
          <Text style={[appStyles.metaDate, { color: theme.accentMutedText }]}>{formatFullDate(analysisResult.createdAt)}</Text>
        </View>
      ) : null}

      <View
        style={[
          appStyles.sectionHero,
          themeMode === "dark" && { backgroundColor: theme.accentGreen, borderColor: theme.border },
        ]}
      >
        <Text style={appStyles.sectionTitle}>глубокий вайбчек</Text>
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          как будто ты показала свой недавний культурный таймлайн очень внимательному психотерапевту, коучу или психоаналитику.
        </Text>
        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          бесплатно доступно {deepAnalysisUsesLeft} из {deepAnalysisTotalFreeUses}. дальше здесь будет оплата за глубокий разбор.
        </Text>
        <PillButton
          label={
            deepAnalysisRunning
              ? "думаем глубже..."
              : deepAnalysisAccess === "paywall"
                ? "лимит исчерпан"
                : "провести глубокий вайбчек"
          }
          variant="primary"
          themeMode={themeMode}
          disabled={deepAnalysisRunning || deepAnalysisAccess === "paywall"}
          onPress={onRunDeepPress}
        />
        {deepAnalysisAccess === "paywall" ? (
          <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
            2 бесплатных глубоких вайбчека уже использованы. следующим шагом сюда можно подключить оплату.
          </Text>
        ) : null}
      </View>

      {deepAnalysisResult ? (
        <View style={[appStyles.tile, themeMode === "dark" ? { backgroundColor: theme.accentBlue, borderColor: theme.border } : appStyles.tileBlue]}>
          <Text style={appStyles.itemTitle}>глубокий срез периода</Text>
          <Text style={[appStyles.helper, { color: theme.accentText }]}>{deepAnalysisResult.summary}</Text>
          {deepAnalysisResult.highlights.map((item) => (
            <Text key={item} style={[appStyles.metaText, { color: theme.accentMutedText }]}>
              • {item}
            </Text>
          ))}
          {deepAnalysisResult.recommendations?.length ? (
            <View style={appStyles.stack}>
              <Text style={[appStyles.label, { color: theme.accentMutedText }]}>что может поддержать сейчас</Text>
              {deepAnalysisResult.recommendations.map((item) => (
                <Text key={item} style={[appStyles.metaText, { color: theme.accentMutedText }]}>
                  → {item}
                </Text>
              ))}
            </View>
          ) : null}
          <Text style={[appStyles.metaDate, { color: theme.accentMutedText }]}>{formatFullDate(deepAnalysisResult.createdAt)}</Text>
        </View>
      ) : null}
    </View>
  );
}
