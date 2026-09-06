export const CONSTRUCTIONS: Record<string, string> = {
  title_pun: "переиначивает название произведения",
  status_jab: "колет культурную позу, статусную фантазию или отношение к привилегии",
  situation: "называет видимую социальную или бытовую ситуацию",
  soft_contradiction: "называет внешнее качество, за ним скрытое напряжение",
  plain_naming: "приёма нет намеренно: просто называет пару",
};

export const FLAWS: Record<string, string> = {
  describes_works: "описывает сами произведения — жанр, звук, громкость, настроение — вместо того, что даёт их столкновение",
  invented_scene: "декорация, которой нет в позициях: кухня, бокал, вечер, окна, танцпол",
  fits_any_pair: "вывод остался бы верным с любой другой парой: «разные вселенные», «на одной волне», «ты умеешь X и Y»",
  mood_word: "«вайб», «атмосфера», «ностальгия», «эклектика»",
  inner_life_diagnosis: "приписывает скрытые мотивы или состояние",
  analyst_voice: "«демонстрирует», «говорит о», «указывает на»",
  hedging: "«в целом», «можно заметить», «балансирует»",
};

// Список закрыт, поэтому незнакомое иначе молча легло бы в ближайшее похожее.
// Частота other показывает, когда список стал мал, а заметки собираются
// в следующую метку.
export const OTHER_LABEL = "other";


export type FormKind = "construction" | "flaw";

export type FormLabel = { runId: string; label: string; kind: FormKind; note: string | null };

export function describeTaxonomy(entries: Record<string, string>) {
  return Object.entries(entries)
    .map(([label, description]) => `${label} — ${description}`)
    .join("\n");
}

function trimNote(note: unknown) {
  return typeof note === "string" && note.trim() ? note.trim().slice(0, 200) : null;
}

export function collectLabels(
  runId: string,
  entry: { construction?: unknown; flaws?: unknown; note?: unknown }
): FormLabel[] {
  const labels: FormLabel[] = [];
  const note = trimNote(entry.note);
  const construction = entry.construction;

  if (typeof construction === "string" && (construction in CONSTRUCTIONS || construction === OTHER_LABEL)) {
    labels.push({ runId, label: construction, kind: "construction", note: construction === OTHER_LABEL ? note : null });
  }

  if (Array.isArray(entry.flaws)) {
    for (const flaw of new Set(entry.flaws)) {
      if (typeof flaw === "string" && (flaw in FLAWS || flaw === OTHER_LABEL)) {
        labels.push({ runId, label: flaw, kind: "flaw", note: flaw === OTHER_LABEL ? note : null });
      }
    }
  }

  return labels;
}
