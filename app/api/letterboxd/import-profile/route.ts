import { NextRequest, NextResponse } from "next/server";
import { importLetterboxdProfile } from "@/lib/letterboxd";

export const runtime = "nodejs";

type Body = {
  profile?: string;
  limit?: number;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body?.profile) {
    return NextResponse.json({ error: "profile is required" }, { status: 400 });
  }

  try {
    const items = await importLetterboxdProfile(body.profile, body.limit ?? 100);
    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "letterboxd import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
