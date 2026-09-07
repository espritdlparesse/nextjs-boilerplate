export function looksTooCorporate(text: string) {
  const normalized = text.toLowerCase();
  const bannedPhrases = [
    "контентный срез",
    "демонстрирует",
    "сочетает в себе",
    "говорит о",
    "свидетельствует",
    "современный вкус",
    "молодежного восприятия",
    "молодежной аудитории",
    "наводит на размышления",
    "отражает тенденции",
    "указывает на",
    "варьируется",
    "представленная треками",
    "поиск глубины",
    "популярной культуры",
    "развлекательном контенте",
    "смешивать развлечения",
    "сложных философских размышлений",
    "этапы на пути к самопознанию",
    "присутствует",
    "список контента",
    "эклектичный вкус",
    "популярность",
  ];

  return bannedPhrases.some((phrase) => normalized.includes(phrase));
}

export function looksTooAbstract(text: string) {
  const normalized = text.toLowerCase();
  const abstractSignals = [
    "культура",
    "контент",
    "аудитория",
    "динамика",
    "восприятие",
    "тенденции",
    "традиции",
    "современность",
    "самопознание",
    "разнообразие",
  ];
  const hitCount = abstractSignals.filter((signal) => normalized.includes(signal)).length;
  return hitCount >= 3;
}

export function looksTooSoft(summary: string) {
  const normalized = summary.toLowerCase();
  const softSignals = [
    "в целом",
    "кажется",
    "можно заметить",
    "присутствует",
    "сочетание",
    "балансирует",
    "вызывает ассоциации",
    "начиная с",
    "заканчивая",
  ];
  return softSignals.some((signal) => normalized.includes(signal));
}

export function looksTooComplicated(text: string) {
  const normalized = text.toLowerCase();
  if (normalized.includes("как будто") || normalized.includes("несмотря на то")) return true;

  return text
    .split(/[.!?]+/)
    .some((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length > 22);
}

export function looksTooGenericRoast(text: string) {
  const normalized = text.toLowerCase();
  const genericSignals = [
    "уличный вайб",
    "странная ностальгия",
    "ностальгия в обручальной",
    "свежие релизы",
    "эклектич",
    "атмосфера",
    "разброс",
    "разные вселенные",
    "на одной волне",
    "заряжаешься",
    "раскачиваешься",
    "старым советским шиком",
    "уличный рэп",
    "московских окраин",
    "громко взорвать",
    "тихо посидеть",
    "бокалом на кухне",
    "с бокалом на кухне",
    "умеешь и",
    "болеешь за",
    "андерграундный шум",
    "легкие поп-романсы",
    "лёгкие поп-романсы",
    "одновременно болеешь",
    "одновременно любишь",
    "умеешь слушать",
    "громко гремит",
    "шепчет о любви",
    "гремит, и тех",
    "громкий трэп",
    "тихие стихи",
    "тихие стихи про память",
    "слушаешь громкий",
    "читаешь тихие",
    "трэп и читаешь",
    "не отпускаешь мысль",
    "говорит бас",
    "говорит бас и",
    "бьет бас",
    "бьёт бас",
    "проверяют, выдержишь ли",
    "в одном ряду оказались",
    "одна растаскивает",
    "другая собирает себя",
    "болезненная честность про",
    "желание всё превратить в игру",
  ];

  return genericSignals.some((signal) => normalized.includes(signal));
}

export function blockingGates(text: string) {
  const hits: string[] = [];
  if (looksTooComplicated(text)) hits.push("too_complicated");
  if (looksTooGenericRoast(text)) hits.push("too_generic");
  return hits;
}

// Наблюдающие гейты: попадают в gate_hits, но отказ не вызывают. Так копится
// статистика по фразам, снятым с боевого пути 2026-08-31 в коммите 1d39166.
export function observedGates(text: string) {
  const hits: string[] = [];
  if (looksTooCorporate(text)) hits.push("observed_corporate");
  if (looksTooAbstract(text)) hits.push("observed_abstract");
  if (looksTooSoft(text)) hits.push("observed_soft");
  return hits;
}

export function normalizeRoastNames(text: string) {
  return text
    .replace(/big baby tape/gi, "биг бейби тейп")
    .replace(/биг бейби тейп/gi, "биг бейби тейп")
    .replace(/avraam russo/gi, "авраам руссо")
    .replace(/авраам руссо/gi, "авраам руссо")
    .replace(/justin timberlake/gi, "джастин тимберлейк")
    .replace(/джастин тимберлейк/gi, "джастин тимберлейк")
    .replace(/bladee/gi, "блейди")
    .replace(/блейди/gi, "блейди");
}
