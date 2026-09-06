export type CulturalCard = {
  context_note: string;
  roast_angles: string[];
};

const EMPTY_PRAISE = [
  "известн", "уникальн", "эмоциональн", "самобытн", "культов", "легендарн",
  "знаков", "выдающ", "популярн", "талантлив", "яркий представитель",
  "один из самых", "не нуждается в представлении",
];

// \b опирается на [A-Za-z0-9_], поэтому перед кириллицей не срабатывает.
const NEWS_MARKERS = [
  /(^|[^\p{L}])(в|за)\s+\d{4}\s+год/iu,
  /(^|[^\p{L}])в\s+(январе|феврале|марте|апреле|мае|июне|июле|августе|сентябре|октябре|ноябре|декабре)\s+\d{4}/iu,
  /(^|[^\p{L}])(выпустил|представил|анонсировал|получил премию|номинирован|дебютировал)/iu,
  /(^|[^\p{L}])релиз/iu,
];

const ANALYST_VOICE = [
  "демонстрирует", "свидетельствует", "отражает тенденции", "указывает на",
  "сочетает в себе", "оказал влияние на", "внес вклад",
];

export function cardFlaws(card: CulturalCard): string[] {
  const text = `${card.context_note} ${(card.roast_angles ?? []).join(" ")}`.toLowerCase();
  const flaws: string[] = [];
  if (EMPTY_PRAISE.some((phrase) => text.includes(phrase))) flaws.push("empty_praise");
  if (NEWS_MARKERS.some((pattern) => pattern.test(text))) flaws.push("news_item");
  if (ANALYST_VOICE.some((phrase) => text.includes(phrase))) flaws.push("analyst_voice");
  if (!card.roast_angles?.length) flaws.push("no_angles");
  return flaws;
}

export function isUsableCard(card: CulturalCard) {
  return cardFlaws(card).length === 0;
}
