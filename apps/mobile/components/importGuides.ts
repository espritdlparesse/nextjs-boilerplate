export type GuideKey = "spotify" | "livelib" | "goodreads" | "letterboxd" | "lastfm" | "kinopoisk" | "mubi";

export const GUIDES: Record<GuideKey, { logo: string; title?: string; steps: string[]; actionLabel: string }> = {
  spotify: {
    logo: "spotify",
    steps: [
      "нажми подключить spotify и пройди логин в браузере",
      "вернись сюда и нажми обновить spotify",
      "после этого можно тянуть любимые треки, недавние прослушивания и свои плейлисты",
    ],
    actionLabel: "подключить / обновить spotify",
  },
  livelib: {
    logo: "livelib",
    title: "нужен csv",
    steps: [
      "у livelib нет одного понятного официального экспорта для нас, поэтому сейчас нужен уже готовый csv",
      "подойдет выгрузка через livelib-backup или любой csv, где есть название и автор",
      "потом просто выбери этот файл из «файлов»",
    ],
    actionLabel: "выбрать файл",
  },
  goodreads: {
    logo: "goodreads",
    title: "нужен csv",
    steps: [
      "в goodreads открой my books и найди import and export",
      "сделай export library, goodreads скачает csv",
      "потом просто выбери этот csv из файлов",
    ],
    actionLabel: "выбрать файл",
  },
  letterboxd: {
    logo: "letterboxd",
    title: "можно без csv",
    steps: [
      "вставь username или ссылку на публичный profile letterboxd",
      "мы попробуем забрать recent diary / watched через public rss",
      "если профиль закрыт или rss не поможет — всегда можно вернуться к watched.csv",
    ],
    actionLabel: "импортировать профиль",
  },
  lastfm: {
    logo: "last.fm",
    title: "recent tracks beta",
    steps: [
      "введи username last.fm и мы попробуем забрать recent tracks через api",
      "если у треков есть scrobble time, они сразу лягут в календарь по дням",
      "если этот способ не сработает, всегда можно загрузить csv",
    ],
    actionLabel: "импортировать профиль",
  },
  kinopoisk: {
    logo: "кинопоиск",
    title: "нужен csv",
    steps: [
      "если у тебя уже есть csv с просмотрами или оценками из кинопоиска, можно загрузить его сюда",
      "если в файле есть watched / isWatched / watched date, мы возьмем только просмотренное",
      "дальше просто выбери файл из «файлов»",
    ],
    actionLabel: "выбрать файл",
  },
  mubi: {
    logo: "mubi",
    title: "нужен csv",
    steps: [
      "если у тебя уже есть csv с просмотренными фильмами из mubi, можно загрузить его сюда",
      "лучше всего подходят колонки title или name, а еще year, director и дата просмотра, если она есть",
      "дальше просто выбери файл из «файлов»",
    ],
    actionLabel: "выбрать файл",
  },
};

