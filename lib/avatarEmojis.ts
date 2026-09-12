import { hashSeed } from "./seededRandom.ts";

// Веб рисует их шрифтом Noto Color Emoji из everyyou.css. Системный шрифт
// Windows не содержит 🫀, и без загруженного шрифта там пустой квадрат.
export const AVATAR_EMOJIS = ["🐸", "😈", "👹", "👀", "🫀", "🐽", "🐣", "🦆", "🐳", "🦦"];

export function avatarEmojiFor(owner: string | number | null | undefined) {
  const seed = `${owner ?? ""}`.trim();
  if (!seed) return AVATAR_EMOJIS[0];
  return AVATAR_EMOJIS[hashSeed(seed) % AVATAR_EMOJIS.length];
}
