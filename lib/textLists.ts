export function trimList(values: string[] | undefined, limit: number, fallback: string[] = []) {
  if (!Array.isArray(values)) return fallback;
  const trimmed = values.map((value) => value.trim()).filter(Boolean).slice(0, limit);
  return trimmed.length > 0 || fallback.length === 0 ? trimmed : fallback;
}
