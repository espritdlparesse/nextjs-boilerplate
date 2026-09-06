export function topEntry(counts: Map<string, number>, fallback: string) {
  let type = fallback;
  let count = 0;
  for (const [candidate, candidateCount] of counts) {
    if (candidateCount > count) {
      count = candidateCount;
      type = candidate;
    }
  }
  return { type, count };
}
