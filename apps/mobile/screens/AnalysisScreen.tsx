import { useEffect, useMemo, useRef, useState } from "react";
import { dayKey, parseDayKey, startOfMonth, addDays, calendarGrid } from "../../../lib/dates";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { PillButton } from "../components/PillButton";
import { appStyles } from "../styles/appStyles";
import { getTheme } from "../styles/theme";
import {
  formatFullDate,
  getConsumptionDate,
  type AnalysisRun,
  type ContentType,
  type LibraryItem,
  type ThemeMode,
} from "../shared/everyyou/domain";

type PeriodRange = {
  from: number;
  to: number;
  label: string;
};

type AnalysisScreenProps = {
  themeMode: ThemeMode;
  library: LibraryItem[];
  counters: {
    total: number;
    byType: Record<ContentType, number>;
  };
  analysisRunning: boolean;
  analysisRunningScope: "full" | "range" | null;
  analysisResult: AnalysisRun | null;
  deepAnalysisRunning: boolean;
  deepAnalysisAccess: "free" | "paywall";
  deepAnalysisUsesLeft: number;
  deepAnalysisTotalFreeUses: number;
  deepAnalysisResult: AnalysisRun | null;
  onRunPress: (range?: PeriodRange) => void;
  onRunDeepPress: (range?: PeriodRange) => void;
};

function startOfDayMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0).getTime();
}

function endOfDayMs(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).getTime();
}

function isSameDay(left: Date, right: Date) {
  return dayKey(left) === dayKey(right);
}

function formatRangeLabel(start: Date, end: Date) {
  const sameDay = dayKey(start) === dayKey(end);
  if (sameDay) {
    return start
      .toLocaleString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
      .replace(/^./, (char) => char.toUpperCase());
  }

  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `${startLabel} — ${endLabel}`;
}

function buildRange(startKey: string | null, endKey: string | null): PeriodRange | null {
  if (!startKey) return null;
  const startDate = parseDayKey(startKey);
  const endDate = parseDayKey(endKey ?? startKey);
  const fromDate = startDate <= endDate ? startDate : endDate;
  const toDate = startDate <= endDate ? endDate : startDate;
  return {
    from: startOfDayMs(fromDate),
    to: endOfDayMs(toDate),
    label: formatRangeLabel(fromDate, toDate),
  };
}

export function AnalysisScreen({
  themeMode,
  library,
  counters,
  analysisRunning,
  analysisRunningScope,
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
  const [periodModalVisible, setPeriodModalVisible] = useState(false);
  const [resultModalVisible, setResultModalVisible] = useState(false);
  const seenResultIdRef = useRef<string | null>(analysisResult?.id ?? null);
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [draftStartKey, setDraftStartKey] = useState<string | null>(null);
  const [draftEndKey, setDraftEndKey] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<PeriodRange | null>(null);

  const itemsByDay = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const item of library) {
      const consumedAt = getConsumptionDate(item);
      if (!consumedAt) continue;
      const key = dayKey(new Date(consumedAt));
      grouped.set(key, (grouped.get(key) ?? 0) + 1);
    }
    return grouped;
  }, [library]);

  const calendarDays = useMemo(() => {
    return calendarGrid(calendarMonth).map((day) => ({ ...day, count: itemsByDay.get(day.key) ?? 0 }));
  }, [calendarMonth, itemsByDay]);

  const nextCalendarDays = useMemo(() => {
    const nextMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
    return calendarGrid(nextMonth).map((day) => ({ ...day, count: itemsByDay.get(day.key) ?? 0 }));
  }, [calendarMonth, itemsByDay]);

  const draftRange = useMemo(() => buildRange(draftStartKey, draftEndKey), [draftStartKey, draftEndKey]);

  const selectedRangeCount = useMemo(() => {
    if (!selectedRange) return 0;
    return library.filter((item) => {
      const consumedAt = getConsumptionDate(item);
      if (!consumedAt) return false;
      return consumedAt >= selectedRange.from && consumedAt <= selectedRange.to;
    }).length;
  }, [library, selectedRange]);

  useEffect(() => {
    if (!analysisResult) return;
    if (analysisResult.id === seenResultIdRef.current) return;
    seenResultIdRef.current = analysisResult.id;
    const timeout = setTimeout(() => setResultModalVisible(true), 0);
    return () => clearTimeout(timeout);
  }, [analysisResult]);

  function openPeriodPicker() {
    const startKey = selectedRange ? dayKey(new Date(selectedRange.from)) : dayKey(new Date());
    const endKey = selectedRange ? dayKey(new Date(selectedRange.to)) : null;
    setDraftStartKey(startKey);
    setDraftEndKey(endKey);
    setCalendarMonth(startOfMonth(parseDayKey(startKey)));
    setPeriodModalVisible(true);
  }

  function onPressDay(targetKey: string) {
    if (!draftStartKey || (draftStartKey && draftEndKey)) {
      setDraftStartKey(targetKey);
      setDraftEndKey(null);
      return;
    }

    if (targetKey < draftStartKey) {
      setDraftEndKey(draftStartKey);
      setDraftStartKey(targetKey);
      return;
    }

    setDraftEndKey(targetKey);
  }

  function confirmPeriod() {
    if (!draftRange) return;
    setSelectedRange(draftRange);
    setPeriodModalVisible(false);
  }

  function resetPeriod() {
    setSelectedRange(null);
    setDraftStartKey(null);
    setDraftEndKey(null);
    setPeriodModalVisible(false);
  }

  function renderMonthBlock(days: typeof calendarDays, monthDate: Date) {
    return (
      <View style={appStyles.stack}>
        <Text style={[appStyles.sectionTitle, { color: theme.text }]}>
          {monthDate
            .toLocaleString("ru-RU", { month: "long" })
            .replace(/^./, (char) => char.toUpperCase())}
        </Text>
        <View style={appStyles.calendarWeekdays}>
          {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((label) => (
            <Text key={`${monthDate.getMonth()}-${label}`} style={[appStyles.calendarWeekday, { color: theme.mutedText }]}>
              {label}
            </Text>
          ))}
        </View>
        <View style={appStyles.calendarGrid}>
          {days.map((day) => {
            const rangeStart = draftRange ? new Date(draftRange.from) : null;
            const rangeEnd = draftRange ? new Date(draftRange.to) : null;
            const inRange =
              rangeStart && rangeEnd
                ? day.date.getTime() >= startOfDayMs(rangeStart) && day.date.getTime() <= startOfDayMs(rangeEnd)
                : false;
            const isStart = rangeStart ? isSameDay(day.date, rangeStart) : false;
            const isEnd = rangeEnd ? isSameDay(day.date, rangeEnd) : false;
            const isSingle = isStart && isEnd;

            return (
              <Pressable
                key={day.key}
                style={[
                  appStyles.calendarDay,
                  { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
                  !day.inMonth && appStyles.calendarDayMuted,
                  inRange && !isSingle && { backgroundColor: themeMode === "dark" ? "#214A33" : "#DFF7D8", borderColor: themeMode === "dark" ? "#214A33" : "#DFF7D8" },
                  (isStart || isEnd) && {
                    backgroundColor: theme.buttonPrimaryBg,
                    borderColor: theme.buttonPrimaryBg,
                  },
                ]}
                onPress={() => onPressDay(day.key)}
              >
                <View style={appStyles.calendarDayHead}>
                  <Text
                    style={[
                      appStyles.calendarDayNumber,
                      {
                        color:
                          isStart || isEnd
                            ? theme.buttonPrimaryText
                            : day.inMonth
                              ? theme.text
                              : theme.quietText,
                      },
                    ]}
                  >
                    {day.date.getDate()}
                  </Text>
                  {day.count > 0 ? (
                    <Text
                      style={[
                        appStyles.calendarDayCount,
                        { color: isStart || isEnd ? theme.buttonPrimaryText : theme.mutedText },
                      ]}
                    >
                      {day.count}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={appStyles.screen}>
      {false && <View
        style={[
          appStyles.sectionHero,
          appStyles.sectionHeroAlt,
          themeMode === "dark" && { backgroundColor: theme.accentBlue, borderColor: theme.border },
        ]}
      >
        <Text style={appStyles.sectionTitle}>вайбчек</Text>
        <Text style={[appStyles.helper, { color: theme.accentText }]}>
          сейчас в библиотеке {counters.total}: музыка {counters.byType.music}, книги {counters.byType.book}, фильмы{" "}
          {counters.byType.movie}.
        </Text>
        <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
          быстрый вайбчек — это короткий культурный срез без глубокого анализа состояния.
        </Text>
        <PillButton
          label={analysisRunningScope === "full" ? "думаем..." : "провести вайбчек"}
          variant="primary"
          themeMode={themeMode}
          disabled={analysisRunning}
          onPress={() => onRunPress(undefined)}
        />
      </View>}

      <View
        style={[
          appStyles.card,
          appStyles.cardAccentYellow,
          themeMode === "dark" && { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={appStyles.sectionTitle}>вайбчек за период</Text>
        <Text style={[appStyles.helper, { color: theme.text }]}>
          выбери кусок своей календарной библиотеки, и нейросетка посмотрит только на него.
        </Text>
        {selectedRange ? (
          <View style={appStyles.stack}>
            <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
              сейчас выбран период: {selectedRange.label.toLowerCase()}
            </Text>
            <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
              внутри него {selectedRangeCount} {selectedRangeCount === 1 ? "айтем" : selectedRangeCount < 5 ? "айтема" : "айтемов"}
            </Text>
          </View>
        ) : (
          <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
            сначала выбери даты, а потом запусти отдельный вайбчек только по ним.
          </Text>
        )}
        <View style={appStyles.row}>
          <PillButton
            label={selectedRange ? "изменить период" : "выбрать период"}
            themeMode={themeMode}
            onPress={openPeriodPicker}
          />
          {selectedRange ? <PillButton label="сбросить" themeMode={themeMode} onPress={resetPeriod} /> : null}
        </View>
        <PillButton
          label={
            analysisRunningScope === "range"
              ? "думаем..."
              : selectedRange
                ? "сделать вайбчек за период"
                : "сначала выбери период"
          }
          variant="primary"
          themeMode={themeMode}
          disabled={analysisRunning || !selectedRange}
          onPress={() => {
            if (!selectedRange) return;
            onRunPress(selectedRange);
          }}
        />
      </View>

      {false && <View
        style={[
          appStyles.sectionHero,
          themeMode === "dark" && { backgroundColor: theme.accentPink, borderColor: theme.border },
        ]}
      >
        <Text style={appStyles.sectionTitle}>вайбчек без прикола</Text>
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
                : "провести вайбчек без прикола"
          }
          variant="primary"
          themeMode={themeMode}
          disabled={deepAnalysisRunning || deepAnalysisAccess === "paywall"}
          onPress={() => onRunDeepPress(selectedRange ?? undefined)}
        />
        {deepAnalysisAccess === "paywall" ? (
          <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
            2 бесплатных глубоких вайбчека уже использованы. следующим шагом сюда можно подключить оплату.
          </Text>
        ) : null}
      </View>}

      {false && deepAnalysisResult
        ? (() => {
            const result = deepAnalysisResult;
            if (!result) return null;
            return (
              <View
                style={[
                  appStyles.tile,
                  themeMode === "dark" ? { backgroundColor: theme.accentBlue, borderColor: theme.border } : appStyles.tileBlue,
                ]}
              >
                <Text style={appStyles.itemTitle}>разбор без прикола</Text>
                {result.periodLabel ? (
                  <Text style={[appStyles.metaText, { color: theme.accentMutedText }]}>
                    период: {result.periodLabel.toLowerCase()}
                  </Text>
                ) : null}
                <Text style={[appStyles.helper, { color: theme.accentText }]}>{result.summary}</Text>
                {result.basis?.length ? (
                  <View style={appStyles.stack}>
                    <Text style={[appStyles.label, { color: theme.accentMutedText }]}>на чем основан вывод</Text>
                    {result.basis.map((item) => (
                      <Text key={item} style={[appStyles.metaText, { color: theme.accentMutedText }]}>
                        {item}
                      </Text>
                    ))}
                  </View>
                ) : null}
                {result.highlights.map((item) => (
                  <Text key={item} style={[appStyles.metaText, { color: theme.accentMutedText }]}>
                    {item}
                  </Text>
                ))}
                {result.recommendations?.length ? (
                  <View style={appStyles.stack}>
                    <Text style={[appStyles.label, { color: theme.accentMutedText }]}>что может поддержать сейчас</Text>
                    {result.recommendations.map((item) => (
                      <Text key={item} style={[appStyles.metaText, { color: theme.accentMutedText }]}>
                        {item}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <Text style={[appStyles.metaDate, { color: theme.accentMutedText }]}>{formatFullDate(result.createdAt)}</Text>
              </View>
            );
          })()
        : null}

      <Modal visible={periodModalVisible} transparent animationType="fade" onRequestClose={() => setPeriodModalVisible(false)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.dayModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={appStyles.dayModalTopRow}>
              <View style={appStyles.dayModalHeading}>
                <Text style={[appStyles.sectionTitle, appStyles.dayModalTitle, { color: theme.text }]}>выбери период</Text>
                <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
                  сначала выбери первый день, потом последний.
                </Text>
              </View>
              <Pressable
                style={[appStyles.dayModalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() => setPeriodModalVisible(false)}
              >
                <Text style={[appStyles.dayModalCloseText, { color: theme.text }]}>закрыть</Text>
              </Pressable>
            </View>

            <View style={appStyles.calendarTopRow}>
              <Pressable
                style={[appStyles.calendarArrow, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() =>
                  setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() - 1, 1)))
                }
              >
                <Text style={[appStyles.calendarArrowText, { color: theme.text }]}>‹</Text>
              </Pressable>
              <Text style={[appStyles.calendarTitle, { color: theme.text }]}>
                {calendarMonth
                  .toLocaleString("ru-RU", { month: "long", year: "numeric" })
                  .replace(/\sг\.$/, "")
                  .replace(/^./, (char) => char.toUpperCase())}
              </Text>
              <View style={appStyles.calendarTopActions}>
                <Pressable
                  style={[appStyles.calendarArrow, appStyles.calendarTodayButton, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  onPress={() => setCalendarMonth(startOfMonth(new Date()))}
                >
                  <Text style={[appStyles.calendarTodayText, { color: theme.text }]}>сегодня</Text>
                </Pressable>
                <Pressable
                  style={[appStyles.calendarArrow, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                  onPress={() =>
                    setCalendarMonth((current) => startOfMonth(new Date(current.getFullYear(), current.getMonth() + 1, 1)))
                  }
                >
                  <Text style={[appStyles.calendarArrowText, { color: theme.text }]}>›</Text>
                </Pressable>
              </View>
            </View>
            <ScrollView style={appStyles.dayModalScroll} contentContainerStyle={appStyles.dayModalContent} showsVerticalScrollIndicator={false}>
              {renderMonthBlock(calendarDays, calendarMonth)}
              {renderMonthBlock(
                nextCalendarDays,
                startOfMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))
              )}
            </ScrollView>

            <View
              style={[
                appStyles.card,
                appStyles.compactCard,
                { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
              ]}
            >
              {draftRange ? (
                <View style={appStyles.row}>
                  <View
                    style={[
                      appStyles.statusChip,
                      { flex: 1, backgroundColor: theme.surface, borderColor: theme.border },
                    ]}
                  >
                    <Text style={[appStyles.statusChipText, { color: theme.text }]}>{draftRange.label.toLowerCase()}</Text>
                  </View>
                </View>
              ) : (
                <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
                  выбери первый день, потом последний.
                </Text>
              )}
              <View style={appStyles.row}>
                <PillButton
                  label="сбросить даты"
                  themeMode={themeMode}
                  onPress={() => {
                    setDraftStartKey(null);
                    setDraftEndKey(null);
                  }}
                />
                <PillButton
                  label={draftRange ? "выбрать период" : "сначала выбери даты"}
                  themeMode={themeMode}
                  variant="primary"
                  disabled={!draftRange}
                  onPress={confirmPeriod}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={resultModalVisible} transparent animationType="fade" onRequestClose={() => setResultModalVisible(false)}>
        <View style={[appStyles.dayModalBackdrop, { backgroundColor: theme.overlay }]}>
          <View style={[appStyles.guideModalSheet, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <View style={appStyles.dayModalTopRow}>
              <View style={appStyles.dayModalHeading}>
                <Text style={[appStyles.sectionTitle, { color: theme.text }]}>результат вайбчека</Text>
                {analysisResult?.periodLabel ? (
                  <Text style={[appStyles.metaText, { color: theme.mutedText }]}>
                    период: {analysisResult.periodLabel.toLowerCase()}
                  </Text>
                ) : null}
              </View>
              <Pressable
                style={[appStyles.resultModalClose, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}
                onPress={() => setResultModalVisible(false)}
              >
                <Text style={[appStyles.resultModalCloseText, { color: theme.text }]}>×</Text>
              </Pressable>
            </View>

            {analysisResult?.persona ? (
              <Text style={[appStyles.label, { color: theme.mutedText }]}>{analysisResult.persona}</Text>
            ) : null}
            <Text style={[appStyles.helper, { color: theme.text }]}>{analysisResult?.summary}</Text>
            <Text style={[appStyles.metaDate, { color: theme.mutedText }]}>
              {analysisResult ? formatFullDate(analysisResult.createdAt) : ""}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}
