export type YandexMusicImportItem = {
  type: "music";
  source: "import_yandex_music";
  title: string;
  authorOrArtist: string;
};

export function isYandexMusicUrl(value: string) {
  try {
    const host = new URL(value.trim()).hostname.replace(/^www\./, "").toLowerCase();
    return host === "music.yandex.ru" || host === "music.yandex.com";
  } catch {
    return false;
  }
}

export function parseYandexPlaylistUrl(value: string) {
  if (!isYandexMusicUrl(value)) return null;

  const parsed = new URL(value.trim());
  const direct = parsed.pathname.match(/^\/playlists\/([a-f0-9-]{20,})\/?$/i);
  if (direct) return { id: direct[1] };

  const legacy = parsed.pathname.match(/^\/users\/([^/]+)\/playlists\/([^/?#]+)\/?$/i);
  if (legacy) return { user: legacy[1], id: legacy[2] };

  return null;
}
