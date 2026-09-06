import { clampTimelineTimestampMs } from "@/lib/timeline";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function decodeXml(text: string) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(text: string) {
  return decodeXml(text.replace(/<[^>]+>/g, " "));
}

function extractLetterboxdUsername(input: string) {
  const raw = input.trim();
  if (!raw) return "";

  const direct = raw.replace(/^@/, "").replace(/^\/+|\/+$/g, "");
  if (/^[a-z0-9_-]+$/i.test(direct) && !direct.includes("letterboxd.com")) {
    return direct;
  }

  try {
    const url = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (!/letterboxd\.com$/i.test(url.hostname)) return "";
    const [username] = url.pathname.split("/").filter(Boolean);
    return username ?? "";
  } catch {
    return "";
  }
}

export async function importLetterboxdProfile(profile: string, limit = 100) {
  const username = extractLetterboxdUsername(profile);
  if (!username) {
    throw new Error("укажи username или ссылку на public profile");
  }

  const rssUrl = `https://letterboxd.com/${username}/rss/`;
  const response = await fetch(rssUrl, {
    headers: {
      "User-Agent": "everyyou/1.0",
    },
    cache: "no-store",
  });

  const xml = await response.text();
  if (!response.ok || !xml.includes("<rss")) {
    throw new Error("не удалось прочитать public profile Letterboxd");
  }

  const itemBlocks = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/g)).map((match) => match[1]);
  const seen = new Set<string>();
  const items = itemBlocks
    .slice(0, Math.min(Math.max(limit, 1), 100))
    .map((block) => {
      const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
      const pubDateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const titleRaw = normalizeText(stripTags(titleMatch?.[1] ?? ""));
      if (!titleRaw) return null;

      const cleanedTitle = titleRaw
        .replace(/^\d+★+\s*/i, "")
        .replace(/\s*-\s*Letterboxd$/i, "")
        .trim();
      const consumedAt = pubDateMatch?.[1] ? clampTimelineTimestampMs(Date.parse(pubDateMatch[1])) : undefined;
      const title = cleanedTitle.toLowerCase();
      const key = `${title}::${typeof consumedAt === "number" ? consumedAt : "undated"}`;
      if (!title || seen.has(key)) return null;
      seen.add(key);

      return {
        type: "movie" as const,
        source: "import_letterboxd" as const,
        title,
        authorOrArtist: "",
        consumedAt,
        timeOrigin: typeof consumedAt === "number" ? ("imported" as const) : undefined,
      };
    })
    .filter(Boolean);

  if (items.length === 0) {
    throw new Error("ничего не нашли в public profile Letterboxd");
  }

  return items;
}
