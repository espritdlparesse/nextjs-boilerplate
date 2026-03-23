export function clampTimelineTimestampMs(ms?: number | null) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return undefined;
  const now = Date.now();
  const futureToleranceMs = 5 * 60 * 1000;
  if (ms > now + futureToleranceMs) {
    return now;
  }
  return ms;
}

export function safeTimelineIsoFromMs(ms?: number | null) {
  const safeMs = clampTimelineTimestampMs(ms);
  return typeof safeMs === "number" ? new Date(safeMs).toISOString() : null;
}
