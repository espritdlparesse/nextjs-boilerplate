export type Tab = "home" | "add" | "library" | "vibe" | "profile" | "admin";

export type VibeDuelVariant = {
  runId: string | null;
  summary: string;
  persona: string;
  basis: string[];
  highlights: string[];
};

export type VibeDuel = { id: string; variants: VibeDuelVariant[] };

export type ItemType = "music" | "book" | "movie" | "custom";
export type ItemSource =
  | "spotify"
  | "goodreads"
  | "letterboxd"
  | "manual"
  | "livelib"
  | "import_spotify"
  | "import_yandex_music"
  | "import_lastfm"
  | "import_letterboxd"
  | "lastfm"
  | "kinopoisk"
  | "mubi";

export type ImportedItem = {
  type: ItemType;
  source: ItemSource;
  title: string;
  creator?: string | null;
  consumedAt?: number | null;
  timeOrigin?: "exact" | "imported" | "estimated" | null;
  custom_category_id?: string | null;
  custom_category_name?: string | null;
  custom_category_emoji?: string | null;
};

export type DbItem = {
  id: string | number;
  tg_user_id?: number;
  type: ItemType;
  source: ItemSource;
  title: string;
  creator?: string | null;
  created_at?: string;
  consumed_at?: string | null;
  time_origin?: "exact" | "imported" | "estimated" | null;
  custom_category_id?: string | null;
  custom_category_name?: string | null;
  custom_category_emoji?: string | null;
};

export type ImportPlatform = "spotify" | "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi";

export type ImportService = {
  id: ImportPlatform;
  title: string;
  subtitle: string;
  icon: string;
  kind: "oauth" | "csv" | "profile";
  instructions?: string[];
  actionLabel?: string;
};
