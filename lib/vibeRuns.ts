import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { hashSeed } from "@/lib/vibecheckFallback";

export const HOLDOUT_PERCENT = 10;

export type VibeRunOutcome = "delivered" | "rejected_422" | "fallback";

export type VibeRunRecord = {
  ownerKey: string;
  ownerKind: "telegram" | "app";
  promptVersion: string;
  model: string;
  outcome: VibeRunOutcome;
  summary?: string | null;
  selectedBasis?: string[];
  plannerObservation?: string | null;
  mediaCounts?: Record<string, number>;
  gateHits?: string[];
  retryCount?: number;
  plansValidCount?: number;
  itemCount?: number;
};

export function isHoldoutOwner(ownerKey: string) {
  return hashSeed(`holdout:${ownerKey}`) % 100 < HOLDOUT_PERCENT;
}

// Отсутствие миграции не должно ломать вайбчек: при любой ошибке записи
// возвращаем null, и роут отвечает пользователю как обычно, без runId.
export async function recordVibeRun(
  sb: ReturnType<typeof supabaseAdmin>,
  record: VibeRunRecord
): Promise<string | null> {
  const { data, error } = await sb
    .from("vibe_runs")
    .insert({
      owner_key: record.ownerKey,
      owner_kind: record.ownerKind,
      prompt_version: record.promptVersion,
      model: record.model,
      outcome: record.outcome,
      summary: record.summary ?? null,
      selected_basis: record.selectedBasis ?? [],
      planner_observation: record.plannerObservation ?? null,
      media_counts: record.mediaCounts ?? {},
      gate_hits: record.gateHits ?? [],
      retry_count: record.retryCount ?? 0,
      plans_valid_count: record.plansValidCount ?? 0,
      item_count: record.itemCount ?? 0,
      is_holdout: isHoldoutOwner(record.ownerKey),
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}

export async function countDeliveredRuns(
  sb: ReturnType<typeof supabaseAdmin>,
  ownerKey: string
): Promise<number> {
  const { count, error } = await sb
    .from("vibe_runs")
    .select("id", { count: "exact", head: true })
    .eq("owner_key", ownerKey)
    .eq("outcome", "delivered");

  if (error) return 0;
  return count ?? 0;
}

export async function recordVibeDuel(
  sb: ReturnType<typeof supabaseAdmin>,
  duel: {
    ownerKey: string;
    ownerKind: "telegram" | "app";
    runIdA: string;
    runIdB: string;
    shownFirst: string;
  }
): Promise<string | null> {
  const { data, error } = await sb
    .from("vibe_duels")
    .insert({
      owner_key: duel.ownerKey,
      owner_kind: duel.ownerKind,
      run_id_a: duel.runIdA,
      run_id_b: duel.runIdB,
      shown_first: duel.shownFirst,
    })
    .select("id")
    .single();

  if (error || !data) return null;
  return data.id as string;
}
