export type TgUser = {
  id?: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type ContentType = "music" | "book" | "film";
export type SourceType = "manual" | "import_spotify";

export type LibraryItem = {
  id: string;
  type: ContentType;
  source: SourceType;
  title: string;
  authorOrArtist: string;
  createdAt?: number;
  consumedAt?: number;
};

export type Tab = "home" | "add" | "library" | "analysis";

export type AnalysisRun = {
  id: string;
  createdAt: number;
  itemCount: number;
  summary: string;
  highlights: string[];
};

export const TYPE_LABEL: Record<ContentType, string> = {
  music: "музыка",
  book: "книга",
  film: "фильм",
};

export const SOURCE_LABEL: Record<SourceType, string> = {
  manual: "сами добавили",
  import_spotify: "импорт",
};

export const PLACEHOLDERS: Record<ContentType, Array<{ title: string; authorOrArtist: string }>> = {
  music: [
    { title: "любой трек", authorOrArtist: "the national" },
    { title: "about today", authorOrArtist: "the national" },
    { title: "codex", authorOrArtist: "radiohead" },
    { title: "movies", authorOrArtist: "weyes blood" },
    { title: "i know the end", authorOrArtist: "phoebe bridgers" },
    { title: "cellophane", authorOrArtist: "fka twigs" },
    { title: "not strong enough", authorOrArtist: "boygenius" },
    { title: "seventeen", authorOrArtist: "sharon van etten" },
    { title: "sparks", authorOrArtist: "beach house" },
    { title: "the rip", authorOrArtist: "portishead" },
    { title: "night shift", authorOrArtist: "lucy dacus" },
  ],
  film: [
    { title: "трудности перевода", authorOrArtist: "коппола" },
    { title: "lost in translation", authorOrArtist: "sofia coppola" },
    { title: "personal shopper", authorOrArtist: "olivier assayas" },
    { title: "american beauty", authorOrArtist: "sam mendes" },
    { title: "her", authorOrArtist: "spike jonze" },
    { title: "under the skin", authorOrArtist: "jonathan glazer" },
    { title: "melancholia", authorOrArtist: "lars von etrier" },
    { title: "the lobster", authorOrArtist: "yorgos lanthimos" },
    { title: "drive my car", authorOrArtist: "ryusuke hamaguchi" },
    { title: "eternal sunshine", authorOrArtist: "michel gondry" },
    { title: "call me by your name", authorOrArtist: "luca guadagnino" },
  ],
  book: [
    { title: "котлован", authorOrArtist: "платонов" },
    { title: "hot milk", authorOrArtist: "deborah levy" },
    { title: "the cost of living", authorOrArtist: "deborah levy" },
    { title: "how should a person be?", authorOrArtist: "sheila heti" },
    { title: "motherhood", authorOrArtist: "sheila heti" },
    { title: "simple passion", authorOrArtist: "annie ernaux" },
    { title: "outline", authorOrArtist: "rachel cusk" },
    { title: "second place", authorOrArtist: "rachel cusk" },
    { title: "weather", authorOrArtist: "jenny offill" },
    { title: "котлован", authorOrArtist: "андрей платонов" },
    { title: "night", authorOrArtist: "elie wiesel" },
  ],
};

export const STORAGE_KEY_LIBRARY = "everyyou.library";
export const LEGACY_LIBRARY_KEYS = ["everyyou.library.v2", "everyyou.library.v3"];

export const STORAGE_KEY_IMPORT = "everyyou.import";
export const LEGACY_IMPORT_KEYS = ["everyyou.import.v2", "everyyou.import.v3"];

export const STORAGE_KEY_ANALYSIS = "everyyou.analysis";
export const LEGACY_ANALYSIS_KEYS = ["everyyou.analysis.v1", "everyyou.analysis.v2"];

export function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function clampText(s: string) {
  return s.trim().replace(/\s+/g, " ");
}

export function formatFullDate(ms: number) {
  const d = new Date(ms);
  return d
    .toLocaleString(undefined, {
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
    const type: ContentType =
      item.type === "music" || item.type === "book" || item.type === "film" ? item.type : "music";
    const source: SourceType =
      item.source === "manual" || item.source === "import_spotify" ? item.source : "manual";
    const title = clampText(String(item.title ?? "")).toLowerCase();
    const authorOrArtist = clampText(String(item.authorOrArtist ?? "")).toLowerCase();

    if (!title || !authorOrArtist) continue;

    const createdAt =
      typeof item.createdAt === "number" && Number.isFinite(item.createdAt) ? item.createdAt : undefined;
    const consumedAt =
      typeof item.consumedAt === "number" && Number.isFinite(item.consumedAt) ? item.consumedAt : undefined;

    out.push({ id, type, source, title, authorOrArtist, createdAt, consumedAt });
  }

  return out;
}

export function getConsumptionDate(item: Pick<LibraryItem, "consumedAt">) {
  return typeof item.consumedAt === "number" && Number.isFinite(item.consumedAt)
    ? item.consumedAt
    : undefined;
}

export function getDisplayName(user: TgUser | null) {
  const first = user?.first_name?.trim();
  const last = user?.last_name?.trim();
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  return fullName || "друг";
}
