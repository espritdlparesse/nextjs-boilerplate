import { hashSeed } from "./seededRandom.ts";

// Emoji 1.0 и 3.0 только: 🫀 из Emoji 13.0 рисовался пустым квадратом в шрифте,
// где этого глифа нет.
export const AVATAR_EMOJIS = ["🐸", "😈", "👹", "👀", "🐙", "🐽", "🐣", "🦆", "🐳", "🐧"];

export function avatarEmojiFor(owner: string | number | null | undefined) {
  const seed = `${owner ?? ""}`.trim();
  if (!seed) return AVATAR_EMOJIS[0];
  return AVATAR_EMOJIS[hashSeed(seed) % AVATAR_EMOJIS.length];
}
