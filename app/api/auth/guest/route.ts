import { NextRequest, NextResponse } from "next/server";
import { createGuestAppUserId, issueAppToken } from "@/lib/appAuth";

export const runtime = "nodejs";

type GuestAuthBody = {
  deviceId?: string;
  name?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as GuestAuthBody | null;
  if (!body?.deviceId) {
    return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
  }

  try {
    const token = issueAppToken({ deviceId: body.deviceId, name: body.name });
    const appUserId = createGuestAppUserId(body.deviceId);

    return NextResponse.json({
      token,
      user: {
        id: appUserId,
        kind: "guest",
        name: body.name ?? null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "failed to issue token";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
