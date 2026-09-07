const RU_PLURAL = new Intl.PluralRules("ru-RU");

export function pluralRu(count: number, one: string, few: string, many: string) {
  const category = RU_PLURAL.select(count);
  if (category === "one") return one;
  if (category === "few") return few;
  return many;
}

export function itemsWord(count: number) {
  return pluralRu(count, "айтем", "айтема", "айтемов");
}
