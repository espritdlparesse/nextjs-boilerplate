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

function parseLivelib(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("файл пустой или не распознан");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const titleCol = findColumn(headers, ["title", "название", "book title", "name"]);
  const authorCol = findColumn(headers, ["author", "автор", "writer"]);
  const dateCol = findColumn(headers, ["date", "дата", "finished", "finish date", "read date"]);

  if (titleCol === -1) {
    throw new Error("не нашли колонку с названием книги. попробуй формат из livelib-backup");
  }

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const item = rowToDraft(
      "book",
      row[titleCol] ?? "",
      authorCol !== -1 ? row[authorCol] ?? "" : "",
      dateCol !== -1 ? normalizeDateInput(row[dateCol] ?? "") : undefined
    );
    if (item) items.push(item);
  }

  if (items.length === 0) throw new Error("книги не найдены в файле");
  return dedupeDrafts(items);
}

function parseGoodreads(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("файл пустой или не распознан");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const titleCol = findColumn(headers, ["title"]);
  const authorCol = findColumn(headers, ["author", "author l-f", "additional authors"]);
  const shelfCol = findColumn(headers, ["exclusive shelf"]);
  const dateReadCol = findColumn(headers, ["date read"]);
  const dateAddedCol = findColumn(headers, ["date added"]);

  if (titleCol === -1) {
    throw new Error("не распознан формат goodreads export");
  }

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const shelf = (row[shelfCol] ?? "").toLowerCase();
    const dateRead = dateReadCol !== -1 ? normalizeDateInput(row[dateReadCol] ?? "") : undefined;
    const dateAdded = dateAddedCol !== -1 ? normalizeDateInput(row[dateAddedCol] ?? "") : undefined;

    const shouldInclude =
      shelf === "read" ||
      shelf === "currently-reading" ||
      typeof dateRead === "number";

    if (!shouldInclude) continue;

    const item = rowToDraft(
      "book",
      row[titleCol] ?? "",
      authorCol !== -1 ? row[authorCol] ?? "" : "",
      dateRead ?? dateAdded
    );
    if (item) items.push(item);
  }

  if (items.length === 0) throw new Error("книги не найдены в файле Goodreads");
  return dedupeDrafts(items);
}

function parseLetterboxd(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("файл пустой");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const nameCol = findColumn(headers, ["name", "title"]);
  const yearCol = findColumn(headers, ["year"]);
  const watchedCol = findColumn(headers, ["watched date", "watcheddate", "diary date", "date"]);

  if (nameCol === -1) throw new Error("не распознан формат Letterboxd CSV");

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const name = row[nameCol] ?? "";
    const year = yearCol !== -1 ? row[yearCol] ?? "" : "";
    const title = year ? `${name} (${year})` : name;
    const item = rowToDraft(
      "movie",
      title,
      "",
      watchedCol !== -1 ? normalizeDateInput(row[watchedCol] ?? "") : undefined
    );
    if (item) items.push(item);
  }

  if (items.length === 0) throw new Error("фильмы не найдены в файле");
  return dedupeDrafts(items);
}

function parseLastfm(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("файл пустой");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const trackCol = findColumn(headers, ["track", "track name", "name", "song"]);
  const artistCol = findColumn(headers, ["artist", "artist name"]);
  const dateCol = findColumn(headers, ["date", "timestamp", "time", "scrobbled at", "played at", "uts"]);

  if (trackCol === -1 || artistCol === -1) {
    throw new Error("не распознан формат Last.fm CSV");
  }

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const item = rowToDraft(
      "music",
      row[trackCol] ?? "",
      row[artistCol] ?? "",
      dateCol !== -1 ? normalizeDateInput(row[dateCol] ?? "") : undefined
    );
    if (item) items.push(item);
  }

  if (items.length === 0) throw new Error("треки не найдены в файле");
  return dedupeDrafts(items);
}

function parseKinopoisk(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("файл пустой");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const nameCol = findColumn(headers, ["name", "название"]);
  const originalNameCol = findColumn(headers, ["originalname", "original name", "english title"]);
  const yearCol = findColumn(headers, ["year", "год"]);
  const watchedCol = findColumn(headers, ["iswatched", "watched", "просмотрено"]);
  const watchedDateCol = findColumn(headers, ["watched date", "watch date", "просмотрено дата", "дата просмотра", "date"]);

  if (nameCol === -1 && originalNameCol === -1) {
    throw new Error("не распознан формат Kinopoisk export");
  }

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const watchedValue = watchedCol !== -1 ? (row[watchedCol] ?? "").toLowerCase() : "true";
    if (watchedCol !== -1 && !["true", "1", "yes", "да"].includes(watchedValue)) continue;

    const baseTitle = row[nameCol] ?? row[originalNameCol] ?? "";
    const year = yearCol !== -1 ? row[yearCol] ?? "" : "";
    const title = year ? `${baseTitle} (${year})` : baseTitle;
    const item = rowToDraft(
      "movie",
      title,
      "",
      watchedDateCol !== -1 ? normalizeDateInput(row[watchedDateCol] ?? "") : undefined
    );
    if (item) items.push(item);
  }

  if (items.length === 0) throw new Error("фильмы не найдены в файле Kinopoisk");
  return dedupeDrafts(items);
}

function parseMubi(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("файл пустой");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const titleCol = findColumn(headers, ["title", "name", "film", "movie"]);
  const yearCol = findColumn(headers, ["year"]);
  const directorCol = findColumn(headers, ["director", "creator"]);
  const watchedDateCol = findColumn(headers, ["watched date", "watch date", "date"]);

  if (titleCol === -1) {
    throw new Error("не распознан формат MUBI CSV");
  }

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const titleBase = row[titleCol] ?? "";
    const year = yearCol !== -1 ? row[yearCol] ?? "" : "";
    const director = directorCol !== -1 ? row[directorCol] ?? "" : "";
    const title = year ? `${titleBase} (${year})` : titleBase;
    const item = rowToDraft(
      "movie",
      title,
      director,
      watchedDateCol !== -1 ? normalizeDateInput(row[watchedDateCol] ?? "") : undefined
    );
    if (item) {
      items.push({
        ...item,
        authorOrArtist: director ? item.authorOrArtist : "",
      });
    }
  }

  if (items.length === 0) throw new Error("фильмы не найдены в файле MUBI");
  return dedupeDrafts(items);
}

export function parseImportedFile(platform: ImportPlatform, text: string) {
  if (platform === "livelib") return parseLivelib(text);
  if (platform === "goodreads") return parseGoodreads(text);
  if (platform === "letterboxd") return parseLetterboxd(text);
  if (platform === "lastfm") return parseLastfm(text);
  if (platform === "kinopoisk") return parseKinopoisk(text);
  return parseMubi(text);
}
