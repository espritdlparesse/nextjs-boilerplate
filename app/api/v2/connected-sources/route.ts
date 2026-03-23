import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { getEffectiveOwner } from "@/lib/ownerLinks";
import { listConnectedSources, upsertConnectedSource, type ConnectedPlatform } from "@/lib/connectedSources";

export const runtime = "nodejs";

type Body = {
  platform?: ConnectedPlatform;
  profile?: string;
};

function isMissingConnectedSourcesTable(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return message.includes("connected_sources");
}

export async function GET(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const owner = await getEffectiveOwner(auth);
    const sources = await listConnectedSources(owner);
    return NextResponse.json({ sources });
  } catch (error) {
    if (isMissingConnectedSourcesTable(error)) {
      return NextResponse.json({ sources: [], warning: "supabase migration missing: connected_sources" });
    }
    const message = error instanceof Error ? error.message : "connected sources failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const platform = body?.platform;
  const profile = body?.profile?.trim();
  if ((platform !== "lastfm" && platform !== "letterboxd") || !profile) {
    return NextResponse.json({ error: "platform and profile are required" }, { status: 400 });
  }

  try {
    const owner = await getEffectiveOwner(auth);
    const source = await upsertConnectedSource(owner, { platform, profile });
    return NextResponse.json({ source });
  } catch (error) {
    if (isMissingConnectedSourcesTable(error)) {
      return NextResponse.json({ error: "supabase migration missing: connected_sources" }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : "connected source save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
