import { hashSeed } from "./seededRandom.ts";

export const AVATAR_EMOJIS = ["🐸", "😈", "👹", "👀", "🫀", "🐽", "🐣", "🦆", "🐳", "🦦"];

export function avatarEmojiFor(owner: string | number | null | undefined) {
  const seed = `${owner ?? ""}`.trim();
  if (!seed) return AVATAR_EMOJIS[0];
  return AVATAR_EMOJIS[hashSeed(seed) % AVATAR_EMOJIS.length];
}
