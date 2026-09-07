import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildOwnerReadFilter, getOwnerScope } from "@/lib/ownerLinks";

export type TimelineRange = { from: number; to: number } | null;

export function readRange(body: { from?: number | null; to?: number | null } | null): TimelineRange {
  const from = typeof body?.from === "number" && Number.isFinite(body.from) ? body.from : null;
  const to = typeof body?.to === "number" && Number.isFinite(body.to) ? body.to : null;
  return from !== null && to !== null ? { from, to } : null;
}

export async function loadTimelineItems<Row>(
  sb: ReturnType<typeof supabaseAdmin>,
  scope: Awaited<ReturnType<typeof getOwnerScope>>,
  range: TimelineRange,
  columns: string
) {
  function query(dateColumn: "consumed_at" | "created_at") {
    let built = sb.from("items").select(columns).or(buildOwnerReadFilter(scope));
    if (range) {
      built = built
        .gte(dateColumn, new Date(range.from).toISOString())
        .lte(dateColumn, new Date(range.to).toISOString());
    }
    const order =
      dateColumn === "consumed_at" ? { ascending: false, nullsFirst: false } : { ascending: false };
    return built.order(dateColumn, order).limit(range ? 1000 : 300);
  }

  const first = await query("consumed_at");
  if (first.error?.message?.toLowerCase().includes("consumed_at")) {
    const retry = await query("created_at");
    return { data: retry.data as Row[] | null, error: retry.error };
  }
  return { data: first.data as Row[] | null, error: first.error };
}
