import { errorMessage } from "@/lib/text";
import type { VibeDuel, VibeDuelVariant } from "@/app/types";
import { apiFetch, getTgInitData } from "@/app/apiFetch";
import { fireAnalytics } from "@/app/analytics";
import { openTelegramInvoice } from "@/lib/telegramInvoice";
import { useState } from "react";

function vibeErrorForStatus(status: number) {
  if (status === 504 || status === 408) return "вайбчек не успел ответить. попробуй еще раз.";
  return `не удалось провести вайбчек (код ${status}).`;
}

function isDuelResponse(duel: VibeDuel | undefined): duel is VibeDuel {
  return Boolean(duel?.id) && Array.isArray(duel?.variants) && duel.variants.length >= 2;
}

export function useDeepVibe() {
  const [deepVibeResult, setDeepVibeResult] = useState("");
  const [deepVibeLoading, setDeepVibeLoading] = useState(false);
  const [deepVibeAccess, setDeepVibeAccess] = useState<"free"|"paid"|"forever"|"none"|null>(null);
  const [deepVibeUsesLeft, setDeepVibeUsesLeft] = useState<number|null>(null);

  async function fetchDeepVibeAccess() {
    try {
      const { json } = await apiFetch("/api/deep-vibe");
      setDeepVibeAccess(json?.access ?? "none");
      setDeepVibeUsesLeft(json?.usesLeft ?? 0);
    } catch {}
  }

  async function runDeepVibe() {
    setDeepVibeLoading(true); setDeepVibeResult("");
    try {
      const { json } = await apiFetch("/api/deep-vibe", { method: "POST", body: JSON.stringify({}), });
      if (json?.error === "no_access") {
        setDeepVibeAccess("none");
        setDeepVibeUsesLeft(0);
        return;
      }
      setDeepVibeResult(json?.result ?? "");
      // Обновляем счётчик после использования
      fetchDeepVibeAccess();
    } catch {
      setDeepVibeResult("не удалось загрузить");
    } finally {
      setDeepVibeLoading(false);
    }
  }

  async function openDeepVibePurchase(product: "deep_vibe_once" | "deep_vibe_forever") {
    const { result, message } = await openTelegramInvoice(product, getTgInitData());
    if (result === "paid") fetchDeepVibeAccess();
    else if (result === "unavailable") alert("Покупка доступна только в Telegram");
    else alert("Не удалось создать инвойс" + (message ? ": " + message : ""));
  }

  function buyDeepVibeOnce() { openDeepVibePurchase("deep_vibe_once"); }

  function buyDeepVibeForever() { openDeepVibePurchase("deep_vibe_forever"); }

  return {
    deepVibeResult, deepVibeLoading, deepVibeAccess, deepVibeUsesLeft,
    fetchDeepVibeAccess, runDeepVibe, buyDeepVibeOnce, buyDeepVibeForever,
  };
}

type VibeOutcome =
  | { kind: "error"; message: string }
  | { kind: "duel"; duel: VibeDuel }
  | { kind: "summary"; summary: string; runId: string | null };

async function requestVibeCheck(): Promise<VibeOutcome> {
  try {
    const { res, json } = await apiFetch("/api/v2/analysis", { method: "POST" });
    if (!res.ok) return { kind: "error", message: json?.error ?? vibeErrorForStatus(res.status) };
    const duel = json?.duel as VibeDuel | undefined;
    if (isDuelResponse(duel)) return { kind: "duel", duel };
    return {
      kind: "summary",
      summary: json?.summary ?? "",
      runId: typeof json?.runId === "string" ? json.runId : null,
    };
  } catch (e) {
    return { kind: "error", message: errorMessage(e, "Network error") };
  }
}

function useMentalAge() {
  const [mentalAge, setMentalAge] = useState("");
  const [mentalAgeLoading, setMentalAgeLoading] = useState(false);

  async function runMentalAge() {
    setMentalAgeLoading(true);
    setMentalAge("");
    try {
      const { json } = await apiFetch("/api/mental-age", { method: "POST" });
      setMentalAge(json?.result ?? "");
    } catch {
      setMentalAge("не удалось посчитать");
    } finally {
      setMentalAgeLoading(false);
    }
  }

  return { mentalAge, mentalAgeLoading, runMentalAge };
}

export function useVibecheck() {
  const [summary, setSummary] = useState("");
  const [vibeLoading, setVibeLoading] = useState(false);
  const [vibeError, setVibeError] = useState("");
  const [vibeFeedback, setVibeFeedback] = useState<"good" | "bad" | null>(null);
  const [vibeRunId, setVibeRunId] = useState<string | null>(null);
  const [vibeDuel, setVibeDuel] = useState<VibeDuel | null>(null);
  const [vibeShownAt, setVibeShownAt] = useState<number | null>(null);
  const [shareRunId, setShareRunId] = useState<string | null>(null);
  const { mentalAge, mentalAgeLoading, runMentalAge } = useMentalAge();

  async function runVibeCheck() {
    if (summary) {
      fireAnalytics("vibecheck_rerolled", {
        runId: vibeRunId,
        msSinceShown: vibeShownAt ? Date.now() - vibeShownAt : null,
        rated: vibeFeedback,
      });
    }
    setVibeLoading(true); setVibeError(""); setSummary(""); setVibeFeedback(null); setVibeRunId(null); setVibeDuel(null);
    const outcome = await requestVibeCheck();
    setVibeLoading(false);
    if (outcome.kind === "error") {
      setVibeError(outcome.message);
      return;
    }
    setVibeShownAt(Date.now());
    if (outcome.kind === "duel") {
      setVibeDuel(outcome.duel);
      return;
    }
    setSummary(outcome.summary);
    setVibeRunId(outcome.runId);
  }

  async function pickDuelWinner(variant: VibeDuelVariant) {
    if (!vibeDuel) return;
    const duelId = vibeDuel.id;
    setVibeDuel(null);
    setSummary(variant.summary);
    setVibeRunId(variant.runId);
    setVibeShownAt(Date.now());
    setVibeFeedback(null);
    apiFetch("/api/v2/vibe-duel", { method: "POST", body: JSON.stringify({ duelId, winnerRunId: variant.runId }) }).catch(() => undefined);
  }

  async function rateVibeCheck(rating: "good" | "bad") {
    if (!summary || vibeFeedback) return;
    setVibeFeedback(rating);
    apiFetch("/api/v2/vibe-feedback", { method: "POST", body: JSON.stringify({ summary, rating, runId: vibeRunId }) }).catch(() => undefined);
  }

  return {
    summary, vibeLoading, vibeError, vibeFeedback, vibeRunId, vibeDuel, shareRunId,
    mentalAge, mentalAgeLoading,
    setShareRunId, setVibeRunId,
    runVibeCheck, pickDuelWinner, rateVibeCheck,
    runMentalAge,
  };
}
