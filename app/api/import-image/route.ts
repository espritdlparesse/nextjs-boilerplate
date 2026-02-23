import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { verifyTelegramInitData } from "@/lib/telegram";

export const runtime = "nodejs";

function getInitData(req: NextRequest) {
  return req.headers.get("x-telegram-init-data") ?? "";
}

function authTg(req: NextRequest) {
  const initData = getInitData(req);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    return { ok: false as const, status: 500, message: "TELEGRAM_BOT_TOKEN missing" };
  }

  const verified = verifyTelegramInitData(initData, botToken);

  if (!verified.ok) {
    return { ok: false as const, status: 401, message: `tg auth failed: ${verified.reason}` };
  }

  const tgUserId = verified.user?.id;
  if (!tgUserId) {
    return { ok: false as const, status: 401, message: "tg user missing" };
  }

  return { ok: true as const, tgUserId: Number(tgUserId) };
}

type ImportedItem = {
  type: "music" | "book" | "movie";
  source: "spotify" | "goodreads" | "letterboxd" | "manual";
  title: string;
  creator?: string | null;
};

function clampItems(items: any[]): ImportedItem[] {
  if (!Array.isArray(items)) return [];
  const out: ImportedItem[] = [];

  for (const it of items.slice(0, 80)) {
    const type = String(it?.type ?? "").toLowerCase();
    const source = String(it?.source ?? "").toLowerCase();
    const title = String(it?.title ?? "").trim();
    const creator = it?.creator == null ? null : String(it.creator).trim();

    if (!title) continue;
    if (!["music", "book", "movie"].includes(type)) continue;

    const src = (["spotify", "goodreads", "letterboxd"].includes(source) ? source : "manual") as ImportedItem["source"];

    out.push({
      type: type as ImportedItem["type"],
      source: src,
      title,
      creator: creator || null,
    });
  }

  return out;
}

function safeParseJson(text: string) {
  // модель иногда может вернуть текст вокруг JSON — вырежем первый {...} блок
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const maybe = text.slice(start, end + 1);
  try {
    return JSON.parse(maybe);
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  const auth = authTg(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "bad form data" }, { status: 400 });

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required (multipart field name: file)" }, { status: 400 });
  }

  if (!file.type?.startsWith("image/")) {
    return NextResponse.json({ error: "only image/* is supported" }, { status: 400 });
  }

  // ограничение на всякий случай
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: "image too large (max 10MB)" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const b64 = buf.toString("base64");
  const dataUrl = `data:${file.type};base64,${b64}`;

  const client = new OpenAI({ apiKey });

  // Вынеси в Vercel env, если захочешь:
  // OPENAI_VISION_MODEL=gpt-4o-mini (или другой vision-моделью)
  const model = process.env.OPENAI_VISION_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const instructions = [
    "Ты помощник, который импортирует контент по скриншоту.",
    "Твоя задача: определить, что на скриншоте (Spotify / Goodreads / Letterboxd / другое) и извлечь список элементов.",
    "Возвращай ТОЛЬКО валидный JSON без пояснений и без обертки в ```.",
    "Не выдумывай элементы: извлекай только то, что реально видно на изображении.",
    "Если не уверен — лучше верни меньше элементов, чем придумай.",
    "",
    "Формат ответа (строго):",
    "{",
    '  "detectedType": "music" | "book" | "movie" | "unknown",',
    '  "detectedSource": "spotify" | "goodreads" | "letterboxd" | "manual",',
    '  "confidence": number,',
    '  "items": [',
    '    { "type": "music"|"book"|"movie", "source": "spotify"|"goodreads"|"letterboxd"|"manual", "title": string, "creator": string|null }',
    "  ],",
    '  "warnings": string[]',
    "}",
    "",
    "Подсказка по скринам:",
    "- Spotify: обычно треки/исполнители, иногда плейлист.",
    "- Goodreads: книги/авторы, прочитано/читаю/хочу прочитать.",
    "- Letterboxd: фильмы, иногда режиссёр/год.",
  ].join("\n");

  const userText =
    "Распознай этот скрин. Верни JSON в указанном формате. В items: максимум 80 элементов.";

  let outputText = "";

  try {
    const resp = await client.responses.create({
      model,
      instructions,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: userText },
            { type: "input_image", image_url: dataUrl },
          ],
        },
      ],
    });

    outputText = resp.output_text ?? "";
  } catch (e: any) {
    const msg = typeof e?.message === "string" ? e.message : "openai error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const parsed = safeParseJson(outputText);
  if (!parsed) {
    return NextResponse.json(
      { error: "failed to parse model output as json", raw: outputText.slice(0, 2000) },
      { status: 500 }
    );
  }

  const detectedType = String(parsed.detectedType ?? "unknown").toLowerCase();
  const detectedSource = String(parsed.detectedSource ?? "manual").toLowerCase();
  const confidence = Number(parsed.confidence ?? 0);

  const items = clampItems(parsed.items ?? []);
  const warnings = Array.isArray(parsed.warnings) ? parsed.warnings.map((x: any) => String(x)) : [];

  return NextResponse.json({
    detectedType: ["music", "book", "movie"].includes(detectedType) ? detectedType : "unknown",
    detectedSource: ["spotify", "goodreads", "letterboxd"].includes(detectedSource) ? detectedSource : "manual",
    confidence: Number.isFinite(confidence) ? confidence : 0,
    items,
    warnings,
  });
}
