import { useEffect, useMemo, useRef, useState } from "react";
import { dayKey, parseDayKey, startOfMonth, calendarGrid } from "../../../lib/dates";
import { itemsWord } from "../../../lib/plural";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { PillButton } from "../components/PillButton";
import { RangeMonthBlock } from "../components/RangeCalendar";
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

  return (
    <View style={appStyles.screen}>

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
              внутри него {selectedRangeCount} {itemsWord(selectedRangeCount)}
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
              <RangeMonthBlock days={calendarDays} month={calendarMonth} range={draftRange} themeMode={themeMode} onPressDay={onPressDay} />
              <RangeMonthBlock
                days={nextCalendarDays}
                month={startOfMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                range={draftRange}
                themeMode={themeMode}
                onPressDay={onPressDay}
              />
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
