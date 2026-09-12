import { hashSeed } from "./seededRandom.ts";

// Веб рисует их шрифтом Noto Color Emoji из everyyou.css. Системный шрифт
// Windows не содержит 🫀, и без загруженного шрифта там пустой квадрат.
export const AVATAR_EMOJIS = ["🐸", "😈", "👹", "👀", "🫀", "🐽", "🐣", "🦆", "🐳", "🦦"];

// null, пока владелец неизвестен: любая заглушка сменится другим эмодзи,
// как только придёт id, и это видно на экране.
export function avatarEmojiFor(owner: string | number | null | undefined) {
  const seed = `${owner ?? ""}`.trim();
  if (!seed) return null;
  return AVATAR_EMOJIS[hashSeed(seed) % AVATAR_EMOJIS.length];
}
