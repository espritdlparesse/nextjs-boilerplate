import { NextRequest, NextResponse } from "next/server";
import { resolveApiIdentity } from "@/lib/auth";
import { buildOwnerReadFilter, getEffectiveOwner, getOwnerScope } from "@/lib/ownerLinks";
import { deleteConnectedSource, listConnectedSources, upsertConnectedSource, type ConnectedPlatform } from "@/lib/connectedSources";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

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

export async function DELETE(req: NextRequest) {
  const auth = resolveApiIdentity(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const url = new URL(req.url);
  const queryPlatform = url.searchParams.get("platform");
  const queryDeleteContent = url.searchParams.get("deleteContent");
  const body = (await req.json().catch(() => null)) as
    | { platform?: ConnectedPlatform; deleteContent?: boolean }
    | null;
  const platform = (body?.platform ?? queryPlatform ?? "").trim() as ConnectedPlatform;
  const deleteContent = body?.deleteContent === true || queryDeleteContent === "1" || queryDeleteContent === "true";

  if (platform !== "lastfm" && platform !== "letterboxd") {
    return NextResponse.json({ error: "valid platform is required" }, { status: 400 });
  }

  try {
    const owner = await getEffectiveOwner(auth);
    const scope = await getOwnerScope(auth);
    await deleteConnectedSource(owner, platform);

    let deletedItems = 0;
    if (deleteContent) {
      const sb = supabaseAdmin();
      const sourceValues = platform === "letterboxd" ? ["letterboxd", "import_letterboxd"] : ["lastfm", "import_lastfm"];
      const { data, error } = await sb
        .from("items")
        .delete()
        .in("source", sourceValues)
        .or(buildOwnerReadFilter(scope))
        .select("id");

      if (error) {
        throw new Error(error.message);
      }
      deletedItems = data?.length ?? 0;
    }

    return NextResponse.json({ ok: true, disconnected: true, deletedItems });
  } catch (error) {
    if (isMissingConnectedSourcesTable(error)) {
      return NextResponse.json({ error: "supabase migration missing: connected_sources" }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : "connected source delete failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
