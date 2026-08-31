export type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type ContentType = "music" | "book" | "film";
export type SourceType = "manual" | "import_spotify" | "import_yandex_music" | "import_lastfm" | "import_letterboxd";
export type TimeOrigin = "exact" | "imported" | "estimated";
export type ThemeMode = "light" | "dark";
export type DailyStepEntry = {
  dayKey: string;
  steps: number;
  source: "apple_health";
};

export type LibraryItem = {
  id: string;
  type: ContentType;
  source: SourceType;
  title: string;
  authorOrArtist: string;
  createdAt?: number;
  consumedAt?: number;
  timeOrigin?: TimeOrigin;
};

export type Tab = "home" | "add" | "library" | "analysis" | "profile";

export type AnalysisRun = {
  id: string;
  createdAt: number;
  itemCount: number;
  persona?: string;
  summary: string;
  highlights: string[];
  basis?: string[];
  recommendations?: string[];
  usesLeft?: number | null;
  periodLabel?: string;
};

export const TYPE_LABEL: Record<ContentType, string> = {
  music: "музыка",
  book: "книга",
  film: "фильм",
};

export const SOURCE_LABEL: Record<SourceType, string> = {
  manual: "сами добавили",
  import_spotify: "импорт",
  import_yandex_music: "импорт",
  import_lastfm: "импорт",
  import_letterboxd: "импорт",
};

export const PLACEHOLDERS: Record<ContentType, Array<{ title: string; authorOrArtist: string }>> = {
  music: [
    { title: "505", authorOrArtist: "arctic monkeys" },
    { title: "obedient", authorOrArtist: "bladee" },
    { title: "how soon is now?", authorOrArtist: "morrissey" },
    { title: "название трека", authorOrArtist: "имя исполнителя" },
  ],
  film: [
    { title: "lost in translation", authorOrArtist: "софия коппола" },
    { title: "сериал the sopranos", authorOrArtist: "не помню кто режиссер" },
    { title: "солярис", authorOrArtist: "андрей тарковский" },
    { title: "melancholia", authorOrArtist: "lars von trier" },
  ],
  book: [
    { title: "котлован", authorOrArtist: "андрей платонов" },
    { title: "название книги", authorOrArtist: "имя писателя" },
    { title: "кольца сатурна", authorOrArtist: "зебальд" },
    { title: "радуга тяготения", authorOrArtist: "пинчон" },
    { title: "hot milk", authorOrArtist: "deborah levy" },
  ],
};

export function getManualTitlePlaceholder(type: ContentType) {
  if (type === "music") return "название трека";
  if (type === "book") return "название книги";
  return "название фильма или сериала";
}

export function getManualCreatorPlaceholder(type: ContentType) {
  if (type === "music") return "имя исполнителя";
  if (type === "book") return "имя писателя";
  return "режиссер или шоураннер";
}

export const STORAGE_KEY_LIBRARY = "everyyou.library";
export const LEGACY_LIBRARY_KEYS = ["everyyou.library.v2", "everyyou.library.v3"];

export const STORAGE_KEY_IMPORT = "everyyou.import";
export const LEGACY_IMPORT_KEYS = ["everyyou.import.v2", "everyyou.import.v3"];

export const STORAGE_KEY_ANALYSIS = "everyyou.analysis";
export const LEGACY_ANALYSIS_KEYS = ["everyyou.analysis.v1", "everyyou.analysis.v2"];
export const STORAGE_KEY_DAILY_STEPS = "everyyou.daily_steps";
export const STORAGE_KEY_HEALTH_STEPS_ENABLED = "everyyou.health_steps_enabled";

export function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clampText(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export function sanitizeTimelineTimestamp(ms?: number) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return undefined;
  const now = Date.now();
  const futureToleranceMs = 5 * 60 * 1000;
  if (ms > now + futureToleranceMs) {
    return now;
  }
  return ms;
}

export function formatFullDate(ms: number) {
  const d = new Date(sanitizeTimelineTimestamp(ms) ?? ms);
  return d
    .toLocaleString("ru-RU", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .toLowerCase();
}

export function normalizeLibrary(raw: unknown[]): LibraryItem[] {
  const out: LibraryItem[] = [];

  for (const x of raw) {
    if (!x || typeof x !== "object") continue;

    const item = x as Record<string, unknown>;
    const id = typeof item.id === "string" ? item.id : uid();
    const rawType = item.type;
    const type: ContentType =
      rawType === "music" || rawType === "book"
        ? rawType
        : rawType === "film" || rawType === "movie"
          ? "film"
          : "music";
    const source: SourceType =
      item.source === "manual" || item.source === "import_spotify" || item.source === "import_yandex_music"
        ? item.source
        : "manual";
    const title = clampText(String(item.title ?? "")).toLowerCase();
    const authorOrArtist = clampText(String(item.authorOrArtist ?? "")).toLowerCase();

    if (!title || !authorOrArtist) continue;

    const createdAt =
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : undefined;
    const consumedAt = sanitizeTimelineTimestamp(
      typeof item.consumedAt === "number" && Number.isFinite(item.consumedAt) ? item.consumedAt : undefined
    );
    const timeOrigin =
      item.timeOrigin === "exact" || item.timeOrigin === "imported" || item.timeOrigin === "estimated"
        ? item.timeOrigin
        : undefined;

    out.push({ id, type, source, title, authorOrArtist, createdAt, consumedAt, timeOrigin });
  }

  return out;
}

export function getConsumptionDate(item: Pick<LibraryItem, "consumedAt">) {
  return sanitizeTimelineTimestamp(
    typeof item.consumedAt === "number" && Number.isFinite(item.consumedAt) ? item.consumedAt : undefined
  );
}

export function getTimeOriginLabel(origin?: TimeOrigin) {
  if (origin === "exact") return "точный день";
  if (origin === "imported") return "дата из сервиса";
  if (origin === "estimated") return "разложили вручную";
  return null;
}

export function getDisplayName(user: TgUser | null) {
  const first = user?.first_name?.trim();
  const last = user?.last_name?.trim();
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  return fullName || "друг";
}
