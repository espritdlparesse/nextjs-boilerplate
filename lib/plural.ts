export function pluralRu(count: number, one: string, few: string, many: string) {
  const tens = Math.abs(count) % 100;
  const units = count % 10;
  if (tens > 10 && tens < 20) return many;
  if (units === 1) return one;
  if (units >= 2 && units <= 4) return few;
  return many;
}

export function itemsWord(count: number) {
  return pluralRu(count, "айтем", "айтема", "айтемов");
}
