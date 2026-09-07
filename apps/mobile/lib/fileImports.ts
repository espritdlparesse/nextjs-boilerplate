import { clampText, sanitizeTimelineTimestamp, type ContentType, type LibraryItem } from "../shared/everyyou/domain";

type ImportPlatform = "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi";

type DraftItem = Pick<
  LibraryItem,
  "type" | "source" | "title" | "authorOrArtist" | "consumedAt" | "timeOrigin"
>;

function parseCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      current += '"';
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += ch;
  }

  result.push(current.trim());
  return result;
}

function dedupeDrafts(items: DraftItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const dateKey = typeof item.consumedAt === "number" ? String(item.consumedAt) : "undated";
    const key = `${item.type}::${item.title}::${item.authorOrArtist}::${dateKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDateInput(raw: string) {
  const value = clampText(raw);
  if (!value) return undefined;

  if (/^\d+$/.test(value)) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      const normalized = value.length >= 13 ? numeric : numeric * 1000;
      return sanitizeTimelineTimestamp(normalized);
    }
  }

  const direct = Date.parse(value);
  if (Number.isFinite(direct)) return sanitizeTimelineTimestamp(direct);

  const dotted = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (dotted) {
    const [, dd, mm, yyyy] = dotted;
    const year = yyyy.length === 2 ? `20${yyyy}` : yyyy;
    const parsed = Date.parse(`${year}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T12:00:00`);
    if (Number.isFinite(parsed)) return sanitizeTimelineTimestamp(parsed);
  }

  return undefined;
}

function rowToDraft(
  type: ContentType,
  title: string,
  authorOrArtist = "",
  consumedAt?: number
): DraftItem | null {
  const normalizedTitle = clampText(title).toLowerCase();
  const normalizedAuthor = clampText(authorOrArtist).toLowerCase();
  if (!normalizedTitle) return null;
  if (type === "music" && !normalizedAuthor) return null;

  return {
    type,
    source: "manual",
    title: normalizedTitle,
    authorOrArtist: normalizedAuthor,
    consumedAt,
    timeOrigin: typeof consumedAt === "number" ? "exact" : undefined,
  };
}

function findColumn(headers: string[], aliases: string[]) {
  for (const alias of aliases) {
    const idx = headers.findIndex((header) => header.includes(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

type RowReader = {
  raw: (column: string) => string | undefined;
  text: (column: string) => string;
  date: (column: string) => number | undefined;
  has: (column: string) => boolean;
};

type ExportSpec = {
  columns: Record<string, string[]>;
  requireAll?: string[];
  requireAny?: string[];
  emptyFileError?: string;
  formatError: string;
  emptyError: string;
  toDraft: (row: RowReader) => DraftItem | null;
};

function withYear(title: string, year: string) {
  return year ? `${title} (${year})` : title;
}

function parseCsvExport(text: string, spec: ExportSpec) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error(spec.emptyFileError ?? "файл пустой");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const columnIndex: Record<string, number> = {};
  for (const [column, aliases] of Object.entries(spec.columns)) {
    columnIndex[column] = findColumn(headers, aliases);
  }

  const allPresent = (spec.requireAll ?? []).every((column) => columnIndex[column] !== -1);
  const anyPresent = !spec.requireAny || spec.requireAny.some((column) => columnIndex[column] !== -1);
  if (!allPresent || !anyPresent) throw new Error(spec.formatError);

  const items: DraftItem[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const cells = parseCsvLine(lines[index]);
    const raw = (column: string) => cells[columnIndex[column]];
    const reader: RowReader = {
      raw,
      text: (column) => raw(column) ?? "",
      date: (column) => (columnIndex[column] === -1 ? undefined : normalizeDateInput(raw(column) ?? "")),
      has: (column) => columnIndex[column] !== -1,
    };
    const item = spec.toDraft(reader);
    if (item) items.push(item);
  }

  if (items.length === 0) throw new Error(spec.emptyError);
  return dedupeDrafts(items);
}

const KINOPOISK_WATCHED = ["true", "1", "yes", "да"];

const EXPORT_SPECS: Record<ImportPlatform, ExportSpec> = {
  livelib: {
    columns: {
      title: ["title", "название", "book title", "name"],
      author: ["author", "автор", "writer"],
      date: ["date", "дата", "finished", "finish date", "read date"],
    },
    requireAll: ["title"],
    emptyFileError: "файл пустой или не распознан",
    formatError: "не нашли колонку с названием книги. попробуй формат из livelib-backup",
    emptyError: "книги не найдены в файле",
    toDraft: (row) => rowToDraft("book", row.text("title"), row.text("author"), row.date("date")),
  },
  goodreads: {
    columns: {
      title: ["title"],
      author: ["author", "author l-f", "additional authors"],
      shelf: ["exclusive shelf"],
      dateRead: ["date read"],
      dateAdded: ["date added"],
    },
    requireAll: ["title"],
    emptyFileError: "файл пустой или не распознан",
    formatError: "не распознан формат goodreads export",
    emptyError: "книги не найдены в файле Goodreads",
    toDraft: (row) => {
      const shelf = row.text("shelf").toLowerCase();
      const dateRead = row.date("dateRead");
      const keep = shelf === "read" || shelf === "currently-reading" || typeof dateRead === "number";
      if (!keep) return null;
      return rowToDraft("book", row.text("title"), row.text("author"), dateRead ?? row.date("dateAdded"));
    },
  },
  letterboxd: {
    columns: {
      name: ["name", "title"],
      year: ["year"],
      watched: ["watched date", "watcheddate", "diary date", "date"],
    },
    requireAll: ["name"],
    formatError: "не распознан формат Letterboxd CSV",
    emptyError: "фильмы не найдены в файле",
    toDraft: (row) =>
      rowToDraft("movie", withYear(row.text("name"), row.text("year")), "", row.date("watched")),
  },
  lastfm: {
    columns: {
      track: ["track", "track name", "name", "song"],
      artist: ["artist", "artist name"],
      date: ["date", "timestamp", "time", "scrobbled at", "played at", "uts"],
    },
    requireAll: ["track", "artist"],
    formatError: "не распознан формат Last.fm CSV",
    emptyError: "треки не найдены в файле",
    toDraft: (row) => rowToDraft("music", row.text("track"), row.text("artist"), row.date("date")),
  },
  kinopoisk: {
    columns: {
      name: ["name", "название"],
      originalName: ["originalname", "original name", "english title"],
      year: ["year", "год"],
      watched: ["iswatched", "watched", "просмотрено"],
      watchedDate: ["watched date", "watch date", "просмотрено дата", "дата просмотра", "date"],
    },
    requireAny: ["name", "originalName"],
    formatError: "не распознан формат Kinopoisk export",
    emptyError: "фильмы не найдены в файле Kinopoisk",
    toDraft: (row) => {
      if (row.has("watched") && !KINOPOISK_WATCHED.includes(row.text("watched").toLowerCase())) return null;
      const base = row.raw("name") ?? row.raw("originalName") ?? "";
      return rowToDraft("movie", withYear(base, row.text("year")), "", row.date("watchedDate"));
    },
  },
  mubi: {
    columns: {
      title: ["title", "name", "film", "movie"],
      year: ["year"],
      director: ["director", "creator"],
      watchedDate: ["watched date", "watch date", "date"],
    },
    requireAll: ["title"],
    formatError: "не распознан формат MUBI CSV",
    emptyError: "фильмы не найдены в файле MUBI",
    toDraft: (row) => {
      const director = row.text("director");
      const item = rowToDraft("movie", withYear(row.text("title"), row.text("year")), director, row.date("watchedDate"));
      if (!item) return null;
      return { ...item, authorOrArtist: director ? item.authorOrArtist : "" };
    },
  },
};

export function parseImportedFile(platform: ImportPlatform, text: string) {
  return parseCsvExport(text, EXPORT_SPECS[platform]);
}
