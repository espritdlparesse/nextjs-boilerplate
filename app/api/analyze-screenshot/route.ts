import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type ScreenshotBody = {
  imageBase64?: string;
  mimeType?: string;
};

type ParsedItem = {
  type: "music" | "book" | "film";
  title: string;
  authorOrArtist: string;
  confidence?: number;
};

function buildPrompt() {
  return [
    "You extract media items from screenshots of libraries, playlists, feeds, notes, and lists.",
    "Return only items that are visible with reasonable confidence.",
    "Infer the media type when possible: music, book, or film.",
    "Use lowercase for title and authorOrArtist.",
    "If nothing is recognizable, return an empty items array.",
  ].join(" ");
}

function buildSchema() {
  return {
    name: "screenshot_library_import",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: {
                type: "string",
                enum: ["music", "book", "film"],
              },
              title: {
                type: "string",
              },
              authorOrArtist: {
                type: "string",
              },
              confidence: {
                type: "number",
              },
            },
            required: ["type", "title", "authorOrArtist", "confidence"],
          },
        },
      },
      required: ["items"],
    },
  };
}

function clampText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeItems(items: ParsedItem[]) {
  return items
    .map((item) => ({
      type: item.type,
      title: clampText(item.title),
      authorOrArtist: clampText(item.authorOrArtist),
      confidence: typeof item.confidence === "number" ? item.confidence : 0,
      source: "manual" as const,
    }))
    .filter((item) => item.title && item.authorOrArtist);
}

function extractResponseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const obj = payload as Record<string, unknown>;

  if (typeof obj.output_text === "string") return obj.output_text;

  const choices = Array.isArray(obj.choices) ? obj.choices : [];
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as Record<string, unknown>).message;
    if (!message || typeof message !== "object") continue;
    const content = (message as Record<string, unknown>).content;
    if (typeof content === "string") return content;
  }

  return "";
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as ScreenshotBody | null;
  if (!body?.imageBase64) {
    return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  }

  const mimeType = body.mimeType?.trim() || "image/jpeg";
  const model = process.env.OPENAI_VISION_MODEL || "gpt-4.1-mini";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: buildPrompt(),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this screenshot and extract library items.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${body.imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: buildSchema(),
      },
    }),
  });

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    return NextResponse.json(
      {
        error: "openai request failed",
        details: payload,
      },
      { status: 500 }
    );
  }

  const outputText = extractResponseText(payload);
  if (!outputText) {
    return NextResponse.json({ items: [] });
  }

  const parsed = JSON.parse(outputText) as { items?: ParsedItem[] };
  const items = normalizeItems(Array.isArray(parsed.items) ? parsed.items : []);

  return NextResponse.json({ items });
}
