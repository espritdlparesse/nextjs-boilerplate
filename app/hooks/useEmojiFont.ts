import { useEffect, useState } from "react";
import { AVATAR_EMOJIS } from "@/lib/avatarEmojis";

const EMOJI_FONT = '52px "Noto Color Emoji"';

// Пока шрифт грузится, система рисует эмодзи своим набором, и после загрузки
// картинка меняется на глазах. Ждём шрифт, а при отказе рисуем чем есть.
export function useEmojiFontReady() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!document.fonts) {
      setReady(true);
      return;
    }
    let live = true;
    const finish = () => {
      if (live) setReady(true);
    };
    document.fonts.load(EMOJI_FONT, AVATAR_EMOJIS.join("")).then(finish, finish);
    return () => {
      live = false;
    };
  }, []);

  return ready;
}
