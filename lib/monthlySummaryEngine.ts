// Рule-based месячное саммари для библиотеки. Без ИИ: сравниваем объём и
// состав контента за месяц с предыдущим месяцем и складываем наблюдение
// из заготовленных фраз — в том же духе, что mentalAgeEngine и
// vibecheckFallback.

export type MonthlyItem = {
  type: string;
  title: string;
  creator?: string | null;
};

function hashSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

type TypeCounts = { music: number; book: number; film: number; other: number };

function countByType(items: MonthlyItem[]): TypeCounts {
  const counts: TypeCounts = { music: 0, book: 0, film: 0, other: 0 };
  for (const item of items) {
    if (item.type === "music") counts.music += 1;
    else if (item.type === "book") counts.book += 1;
    else if (item.type === "film" || item.type === "movie") counts.film += 1;
    else counts.other += 1;
  }
  return counts;
}

function topCreator(items: MonthlyItem[]): { creator: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const item of items) {
    const creator = item.creator?.trim();
    if (!creator) continue;
    const key = creator.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best: { creator: string; count: number } | null = null;
  for (const [creator, count] of counts.entries()) {
    if (!best || count > best.count) best = { creator, count };
  }
  return best;
}

/**
 * @param currentItems  айтемы за месяц, для которого строим саммари
 * @param previousItems айтемы за предыдущий месяц (для сравнения объёма); можно опустить
 */
export function generateMonthlySummary(
  currentItems: MonthlyItem[],
  previousItems: MonthlyItem[] = []
): string | null {
  if (currentItems.length === 0) return null;

  const seed = hashSeed(currentItems.map((i) => `${i.type}|${i.title}|${i.creator ?? ""}`).join("~"));
  const rng = mulberry32(seed);

  const total = currentItems.length;
  const prevTotal = previousItems.length;
  const counts = countByType(currentItems);

  const clauses: string[] = [];

  // 1) Объём месяца относительно предыдущего
  if (prevTotal >= 3) {
    const ratio = total / prevTotal;
    if (ratio <= 0.4) {
      clauses.push(
        pick(rng, [
          "в этом месяце заметно тише обычного — либо было не до контента, либо было чем заняться помимо него",
          "добавлений в разы меньше, чем в прошлый раз — похоже, месяц прошёл больше в реальной жизни, чем в библиотеке",
          "почти пусто по сравнению с прошлым месяцем — наверное, было слишком много всего вокруг, чтобы ещё и это фиксировать",
        ])
      );
    } else if (ratio >= 1.8) {
      clauses.push(
        pick(rng, [
          "месяц вышел заметно активнее предыдущего",
          "добавляла куда охотнее, чем обычно — видно, что было настроение фиксировать всё подряд",
          "объём сильно вырос по сравнению с прошлым месяцем",
        ])
      );
    }
  }

  // 2) Состав месяца: чего было много, чего почти не было
  if (total >= 3) {
    const musicShare = counts.music / total;
    const bookShare = counts.book / total;
    const filmShare = counts.film / total;

    if (musicShare >= 0.75) {
      clauses.push(
        pick(rng, [
          "почти сплошная музыка — похоже, месяц прошёл под фоновый шум, а не под сюжет",
          "музыка забрала почти весь месяц — на что-то более вдумчивое, кажется, не было сил",
        ])
      );
    } else if (filmShare >= 0.6) {
      clauses.push(
        pick(rng, [
          "много фильмов — похоже, хотелось смотреть, а не проживать самой",
          "кино на этот месяц выиграло у всего остального",
        ])
      );
    } else if (bookShare >= 0.6) {
      clauses.push(
        pick(rng, [
          "неожиданно много книг — редкий сосредоточенный месяц",
          "книги явно победили — либо был отпуск, либо осознанная попытка сбежать от экранов",
        ])
      );
    } else if (bookShare === 0 && (counts.music > 0 || counts.film > 0)) {
      clauses.push(
        pick(rng, [
          "книг почти не было — видимо, было не до чтения",
          "ни одной книги за весь месяц — либо не было настроения, либо не было времени",
        ])
      );
    }
  }

  // 3) Повторяющийся автор/артист — намёк на зацикленность
  const top = topCreator(currentItems);
  if (top && top.count >= 3) {
    clauses.push(`${top.creator} в этом месяце был почти всё время рядом`);
  }

  if (clauses.length === 0) {
    clauses.push(
      pick(rng, [
        "обычный по темпу месяц, без явных перекосов",
        "ровно и разнообразно — ни один тип контента не тянул одеяло на себя",
      ])
    );
  }

  const sentence = clauses.join(", а ещё ");
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".";
}
