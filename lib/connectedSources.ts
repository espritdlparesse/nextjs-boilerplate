import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { EffectiveOwner } from "@/lib/ownerLinks";

export type ConnectedPlatform = "lastfm" | "letterboxd";

export type ConnectedSourceRecord = {
  platform: ConnectedPlatform;
  profile: string;
  lastSyncedAt: string | null;
};

export async function listConnectedSources(owner: EffectiveOwner): Promise<ConnectedSourceRecord[]> {
  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("connected_sources")
    .select("platform, profile, last_synced_at")
    .eq("owner_key", owner.ownerKey)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).flatMap((row) => {
    if ((row.platform !== "lastfm" && row.platform !== "letterboxd") || typeof row.profile !== "string") {
      return [];
    }

    return [
      {
        platform: row.platform,
        profile: row.profile,
        lastSyncedAt: typeof row.last_synced_at === "string" ? row.last_synced_at : null,
      },
    ];
  });
}

export async function upsertConnectedSource(
  owner: EffectiveOwner,
  input: { platform: ConnectedPlatform; profile: string }
): Promise<ConnectedSourceRecord> {
  const sb = supabaseAdmin();
  const now = new Date().toISOString();
  const { data, error } = await sb
    .from("connected_sources")
    .upsert(
      {
        owner_key: owner.ownerKey,
        owner_kind: owner.ownerKind,
        platform: input.platform,
        profile: input.profile,
        last_synced_at: now,
        updated_at: now,
      },
      { onConflict: "owner_key,platform" }
    )
    .select("platform, profile, last_synced_at")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    platform: data.platform,
    profile: data.profile,
    lastSyncedAt: data.last_synced_at ?? null,
  };
}
