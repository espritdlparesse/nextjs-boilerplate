import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { runDeepVibeCheck, runVibeCheck } from "../lib/api";
import { STORAGE_KEY_ANALYSIS, uid, type AnalysisRun, type ContentType } from "../shared/everyyou/domain";

export function useAnalysis(deps: {
  apiToken: string | null;
  counters: { total: number; byType: Record<ContentType, number> };
  fireAnalytics: (event: string, properties?: Record<string, unknown>) => void;
  setToastMessage: (message: string | null) => void;
  loaded: boolean;
}) {
  const { apiToken, counters, fireAnalytics, setToastMessage, loaded } = deps;
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [analysisRunningScope, setAnalysisRunningScope] = useState<"full" | "range" | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AnalysisRun[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisRun | null>(null);
  const [deepAnalysisRunning, setDeepAnalysisRunning] = useState(false);
  const [deepAnalysisResult, setDeepAnalysisResult] = useState<AnalysisRun | null>(null);
  const [deepAnalysisAccess, setDeepAnalysisAccess] = useState<"free" | "paywall">("free");
  const [deepAnalysisUsesLeft, setDeepAnalysisUsesLeft] = useState<number>(2);
  const [deepAnalysisTotalFreeUses, setDeepAnalysisTotalFreeUses] = useState<number>(2);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY_ANALYSIS, JSON.stringify(analysisHistory)).catch(() => undefined);
  }, [analysisHistory, loaded]);

  async function runFakeAnalysis(range?: { from: number; to: number; label: string }) {
    if (analysisRunning) return;
    setAnalysisRunning(true);
    setAnalysisRunningScope(range ? "range" : "full");
    fireAnalytics("vibecheck_started", {
      librarySize: counters.total,
      tier: "regular",
      periodLabel: range?.label ?? null,
      periodFrom: range?.from ?? null,
      periodTo: range?.to ?? null,
    });

    try {
      if (apiToken) {
        const data = await runVibeCheck(apiToken, range ? { from: range.from, to: range.to } : undefined);
        const result: AnalysisRun = {
          id: uid(),
          createdAt: Date.now(),
          itemCount: data.itemCount,
          persona: data.persona,
          summary: data.summary,
          highlights: data.highlights,
          basis: data.basis ?? [],
          periodLabel: range?.label,
        };

        setAnalysisResult(result);
        setAnalysisHistory([result]);
        setToastMessage("вайбчек готов");
        fireAnalytics("vibecheck_completed", {
          itemCount: data.itemCount,
          tier: "regular",
          periodLabel: range?.label ?? null,
        });
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 900));

      const total = counters.total;
      const byType = counters.byType;

      const result: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: total,
        persona: total === 0 ? "" : "вкус пока без легенды",
        summary:
          total === 0
            ? "пока пусто. добавьте пару айтемов и мы начнем собирать ваш паттерн вкуса."
            : `в библиотеке ${total} айтемов. музыка: ${byType.music}, книги: ${byType.book}, фильмы: ${byType.movie}.`,
        highlights:
          total === 0
            ? ["можно начать с импорта spotify", "или добавить что-то вручную"]
            : [
                "вкусу явно нравится ходить между поп-крючками и вещами посложнее",
              "повторяющиеся имена и настроения быстро выдают твой текущий эмоциональный коридор",
              "это быстрый вайбчек: он скорее намечает настроение, чем копает глубоко",
              ],
        basis:
          total === 0
            ? []
            : ["последние добавленные айтемы", "повторяющиеся имена и настроения"],
        periodLabel: range?.label,
      };

      setAnalysisResult(result);
      setAnalysisHistory([result]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "vibe check failed";
      const fallback: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: counters.total,
        persona: "",
        summary: `не удалось провести серверный вайбчек: ${message}`,
        highlights: ["проверь настройки сервера", "и попробуй еще раз"],
        basis: [],
        periodLabel: range?.label,
      };
      setAnalysisResult(fallback);
      setAnalysisHistory([fallback]);
    } finally {
      setAnalysisRunning(false);
      setAnalysisRunningScope(null);
    }
  }

  async function runDeepAnalysis(range?: { from: number; to: number; label: string }) {
    if (deepAnalysisRunning) return;
    if (deepAnalysisAccess === "paywall") {
      setToastMessage("2 бесплатных глубоких вайбчека уже использованы");
      fireAnalytics("deep_vibe_paywall_seen");
      return;
    }

    setDeepAnalysisRunning(true);
    fireAnalytics("vibecheck_started", {
      librarySize: counters.total,
      tier: "deep",
      usesLeft: deepAnalysisUsesLeft,
      periodLabel: range?.label ?? null,
      periodFrom: range?.from ?? null,
      periodTo: range?.to ?? null,
    });

    try {
      if (!apiToken) {
        throw new Error("для вайбчека без прикола нужен backend");
      }

      const data = await runDeepVibeCheck(apiToken, range ? { from: range.from, to: range.to } : undefined);
      const result: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: data.itemCount,
        summary: data.summary,
        highlights: data.highlights,
        basis: data.basis ?? [],
        recommendations: data.recommendations ?? [],
        usesLeft: data.usesLeft,
        periodLabel: range?.label,
      };

      setDeepAnalysisResult(result);
      setDeepAnalysisAccess(data.access);
      setDeepAnalysisUsesLeft(data.usesLeft);
      setDeepAnalysisTotalFreeUses(data.totalFreeUses);
      setToastMessage("вайбчек без прикола готов");
      fireAnalytics("vibecheck_completed", {
        itemCount: data.itemCount,
        tier: "deep",
        usesLeft: data.usesLeft,
        periodLabel: range?.label ?? null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "deep vibe failed";
      if (message === "paywall") {
        setDeepAnalysisAccess("paywall");
        setDeepAnalysisUsesLeft(0);
        setToastMessage("2 бесплатных глубоких вайбчека уже использованы");
        fireAnalytics("deep_vibe_paywall_seen");
        return;
      }

      const friendlySummary =
        message.includes("404")
          ? "вайбчек без прикола пока не доехал до сервера. попробуй еще раз чуть позже, когда обновится backend."
          : `не удалось провести вайбчек без прикола: ${message}`;
      const friendlyHighlights = message.includes("404")
        ? ["это похоже на старый деплой сервера", "не твоя ошибка — просто повтори попытку позже"]
        : ["проверь настройки сервера", "и попробуй еще раз"];

      const fallback: AnalysisRun = {
        id: uid(),
        createdAt: Date.now(),
        itemCount: counters.total,
        summary: friendlySummary,
        highlights: friendlyHighlights,
        basis: [],
        recommendations: [],
        usesLeft: deepAnalysisUsesLeft,
        periodLabel: range?.label,
      };
      setDeepAnalysisResult(fallback);
    } finally {
      setDeepAnalysisRunning(false);
    }
  }

  return {
    analysisRunning, analysisRunningScope, analysisHistory, analysisResult,
    deepAnalysisRunning, deepAnalysisResult, deepAnalysisAccess,
    deepAnalysisUsesLeft, deepAnalysisTotalFreeUses,
    setAnalysisHistory, setAnalysisResult, setDeepAnalysisResult,
    setDeepAnalysisAccess, setDeepAnalysisUsesLeft, setDeepAnalysisTotalFreeUses,
    runFakeAnalysis, runDeepAnalysis,
  };
}
