import { clampText, type ContentType, type LibraryItem } from "../shared/everyyou/domain";

type ImportPlatform = "livelib" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi";

type DraftItem = Pick<LibraryItem, "type" | "source" | "title" | "authorOrArtist">;

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
    const key = `${item.type}::${item.title}::${item.authorOrArtist}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowToDraft(type: ContentType, title: string, authorOrArtist = ""): DraftItem | null {
  const normalizedTitle = clampText(title).toLowerCase();
  const normalizedAuthor = clampText(authorOrArtist).toLowerCase();
  if (!normalizedTitle) return null;
  if (type === "music" && !normalizedAuthor) return null;

  return {
    type,
    source: "manual",
    title: normalizedTitle,
    authorOrArtist: normalizedAuthor,
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

  if (titleCol === -1) {
    throw new Error("не нашли колонку с названием книги. попробуй формат из livelib-backup");
  }

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const item = rowToDraft("book", row[titleCol] ?? "", authorCol !== -1 ? row[authorCol] ?? "" : "");
    if (item) items.push(item);
  }

  if (items.length === 0) throw new Error("книги не найдены в файле");
  return dedupeDrafts(items);
}

function parseLetterboxd(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error("файл пустой");

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const nameCol = findColumn(headers, ["name", "title"]);
  const yearCol = findColumn(headers, ["year"]);

  if (nameCol === -1) throw new Error("не распознан формат Letterboxd CSV");

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const name = row[nameCol] ?? "";
    const year = yearCol !== -1 ? row[yearCol] ?? "" : "";
    const title = year ? `${name} (${year})` : name;
    const item = rowToDraft("film", title);
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

  if (trackCol === -1 || artistCol === -1) {
    throw new Error("не распознан формат Last.fm CSV");
  }

  const items: DraftItem[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = parseCsvLine(lines[i]);
    const item = rowToDraft("music", row[trackCol] ?? "", row[artistCol] ?? "");
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
    const item = rowToDraft("film", title);
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
    const item = rowToDraft("film", title, director);
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
  if (platform === "letterboxd") return parseLetterboxd(text);
  if (platform === "lastfm") return parseLastfm(text);
  if (platform === "kinopoisk") return parseKinopoisk(text);
  return parseMubi(text);
}
