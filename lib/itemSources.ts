const LEGACY_SOURCE_ALIASES: Record<string, string> = {
  spotify: "spotify",
  import_spotify: "spotify",
  yandex_music: "import_yandex_music",
  import_yandex_music: "import_yandex_music",
  goodreads: "goodreads",
  letterboxd: "letterboxd",
  import_letterboxd: "letterboxd",
};

export function normalizeLegacySource(raw: unknown) {
  return LEGACY_SOURCE_ALIASES[String(raw ?? "").toLowerCase()] ?? "manual";
}
