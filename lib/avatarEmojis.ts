export const AVATAR_EMOJIS = ["🐸", "😈", "👹", "👀", "🫀", "🐽", "🐣", "🦆", "🐳", "🦦"];

export function randomAvatarEmojiIndex() {
  return Math.floor(Math.random() * AVATAR_EMOJIS.length);
}

export function avatarEmojiAt(index: number) {
  return AVATAR_EMOJIS[index % AVATAR_EMOJIS.length];
}
