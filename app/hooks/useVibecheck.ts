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
      const { res, json } = await apiFetch("/api/deep-vibe");
      setDeepVibeAccess(json?.access ?? "none");
      setDeepVibeUsesLeft(json?.usesLeft ?? 0);
    } catch {}
  }

  async function runDeepVibe() {
    setDeepVibeLoading(true); setDeepVibeResult("");
    try {
      const { res, json } = await apiFetch("/api/deep-vibe", { method: "POST", body: JSON.stringify({}), });
      if (json?.error === "no_access") {
        setDeepVibeAccess("none");
        setDeepVibeUsesLeft(0);
        return;
      }
      setDeepVibeResult(json?.result ?? "");
      // Обновляем счётчик после использования
      fetchDeepVibeAccess();
    } catch (e: any) {
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

export function useVibecheck() {
  const [summary, setSummary] = useState("");
  const [vibeLoading, setVibeLoading] = useState(false);
  const [vibeError, setVibeError] = useState("");
  const [vibeFeedback, setVibeFeedback] = useState<"good" | "bad" | null>(null);
  const [vibeRunId, setVibeRunId] = useState<string | null>(null);
  const [vibeDuel, setVibeDuel] = useState<VibeDuel | null>(null);
  const [vibeShownAt, setVibeShownAt] = useState<number | null>(null);
  const [shareRunId, setShareRunId] = useState<string | null>(null);
  const [mentalAge, setMentalAge] = useState("");
  const [mentalAgeLoading, setMentalAgeLoading] = useState(false);

  async function runVibeCheck() {
    if (summary) {
      fireAnalytics("vibecheck_rerolled", {
        runId: vibeRunId,
        msSinceShown: vibeShownAt ? Date.now() - vibeShownAt : null,
        rated: vibeFeedback,
      });
    }
    setVibeLoading(true); setVibeError(""); setSummary(""); setVibeFeedback(null); setVibeRunId(null); setVibeDuel(null);
    try {
      const { res, json } = await apiFetch("/api/v2/analysis", { method: "POST", });
      if (!res.ok) {
        setVibeError(json?.error ?? vibeErrorForStatus(res.status));
        return;
      }
      const duel = json?.duel as VibeDuel | undefined;
      if (isDuelResponse(duel)) {
        setVibeDuel(duel);
        setVibeShownAt(Date.now());
        return;
      }
      setSummary(json?.summary ?? "");
      setVibeRunId(typeof json?.runId === "string" ? json.runId : null);
      setVibeShownAt(Date.now());
    } catch (e: any) {
      setVibeError(e?.message ?? "Network error");
    } finally {
      setVibeLoading(false);
    }
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

  async function runMentalAge() {
    setMentalAgeLoading(true); setMentalAge("");
    try {
      const { res, json } = await apiFetch("/api/mental-age", { method: "POST" });
      setMentalAge(json?.result ?? "");
    } catch (e: any) {
      setMentalAge("не удалось посчитать");
    } finally {
      setMentalAgeLoading(false);
    }
  }

  return {
    summary, vibeLoading, vibeError, vibeFeedback, vibeRunId, vibeDuel, shareRunId,
    mentalAge, mentalAgeLoading,
    setShareRunId, setVibeRunId,
    runVibeCheck, pickDuelWinner, rateVibeCheck,
    runMentalAge,
  };
}
