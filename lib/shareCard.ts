export type ShareCardItem = {
type: string;
title: string;
creator?: string | null;
};

export async function generateShareCard(
items: ShareCardItem[],
text?: string,
type?: "vibe" | "deep",
customItems?: ShareCardItem[]
): Promise<string> {
  const canvas = document.createElement("canvas");
  const W = 1080, H = 1080;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // Фон белый
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Тонкая рамка
  ctx.strokeStyle = "#e8e8e8";
  ctx.lineWidth = 2;
  ctx.strokeRect(40, 40, W - 80, H - 80);

  // Логотип — тонкий serif
  ctx.fillStyle = "#000000";
  ctx.font = "300 80px Georgia, serif";
  ctx.fillText("every you", 80, 150);

  // Подпись типа
  ctx.fillStyle = "#999";
  ctx.font = "28px -apple-system, sans-serif";
  const label = type === "deep" ? "вайбчек без прикола" : type === "vibe" ? "вайбчек" : "моя библиотека";
  ctx.fillText(label.toUpperCase(), 80, 195);

  // Разделитель
  ctx.fillStyle = "#000000";
  ctx.fillRect(80, 218, W - 160, 1);

  if (text) {
    // Режим вайбчека — выводим текст
    ctx.fillStyle = "#000000";
    ctx.font = "300 38px Georgia, serif";
    ctx.font = "italic 38px Georgia, serif";
    const clean = text.split("**").join("").split("\n\n").join("\n").trim();

    const words = clean.split(" ");
    let line = "";
    let y = 290;
    const maxWidth = W - 160;
    const lineH = 56;
    const maxY = H - 200;

    for (const word of words) {
      if (word === "\n" || word.includes("\n")) {
        ctx.fillText(line, 80, y);
        line = word.replace("\n", "");
        y += lineH;
        if (y > maxY) { ctx.fillText("...", 80, y); break; }
        continue;
      }
      const test = line + (line ? " " : "") + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, 80, y);
        line = word;
        y += lineH;
        if (y > maxY) { ctx.fillText("...", 80, y); break; }
      } else { line = test; }
    }
    if (y <= maxY && line) ctx.fillText(line, 80, y);
  } else {
    // Режим библиотеки — показываем топ контент
    const sourceItems = customItems ?? items;
    const music = sourceItems.filter(i => i.type === "music").slice(0, 4);
    const books = sourceItems.filter(i => i.type === "book").slice(0, 3);
    const movies = sourceItems.filter(i => i.type === "movie").slice(0, 3);

    let y = 270;

    const drawSection = (emoji: string, title: string, list: typeof items) => {
      if (list.length === 0) return;
      ctx.fillStyle = "#999";
      ctx.font = "22px -apple-system, sans-serif";
      ctx.fillText(`${emoji}  ${title.toUpperCase()}`, 80, y);
      y += 40;
      ctx.fillStyle = "#000000";
      ctx.font = "300 34px Georgia, serif";
      for (const item of list) {
        const t = item.creator ? `${item.title} — ${item.creator}` : item.title;
        const short = t.length > 42 ? t.slice(0, 40) + "…" : t;
        ctx.fillText(short, 80, y);
        y += 50;
      }
      y += 20;
    };

    drawSection("♫", "музыка", music);
    drawSection("📖", "книги", books);
    drawSection("🎬", "фильмы", movies);
  }

  // Ссылка внизу
  ctx.fillStyle = "#999";
  ctx.font = "24px -apple-system, sans-serif";
  ctx.fillText("t.me/every_you_bot", 80, H - 70);

  ctx.fillStyle = "#000000";
  ctx.font = "300 36px Georgia";
  ctx.fillText("✦", W - 110, H - 65);

  return canvas.toDataURL("image/png");
}
