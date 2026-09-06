import { resolveApiIdentity, type ApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type EffectiveOwner = {
  ownerKey: string;
  ownerKind: "telegram" | "app";
  legacyTgUserId?: number;
};

type OwnerScope = {
  primaryOwner: EffectiveOwner;
  readOwnerKeys: string[];
  legacyTgUserId?: number;
};

export type { EffectiveOwner };
export type { OwnerScope };

function parseTelegramOwnerKey(ownerKey: string) {
  if (!ownerKey.startsWith("tg:")) return null;
  const value = Number(ownerKey.slice(3));
  return Number.isFinite(value) ? value : null;
}

export async function getEffectiveOwner(auth: Extract<ApiIdentity, { ok: true }>): Promise<EffectiveOwner> {
  if (auth.authType === "telegram") {
    return {
      ownerKey: auth.ownerKey,
      ownerKind: auth.ownerKind,
      legacyTgUserId: auth.legacyTgUserId,
    };
  }

  const sb = supabaseAdmin();
  const { data } = await sb
    .from("owner_links")
    .select("telegram_owner_key")
    .eq("app_owner_key", auth.ownerKey)
    .not("telegram_owner_key", "is", null)
    .order("claimed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const telegramOwnerKey = data?.telegram_owner_key;
  if (!telegramOwnerKey) {
    return {
      ownerKey: auth.ownerKey,
      ownerKind: auth.ownerKind,
    };
  }

  const legacyTgUserId = parseTelegramOwnerKey(telegramOwnerKey) ?? undefined;
  return {
    ownerKey: telegramOwnerKey,
    ownerKind: "telegram",
    legacyTgUserId,
  };
}

export async function getOwnerScope(auth: Extract<ApiIdentity, { ok: true }>): Promise<OwnerScope> {
  if (auth.authType === "telegram") {
    const sb = supabaseAdmin();
    const { data } = await sb
      .from("owner_links")
      .select("app_owner_key")
      .eq("telegram_owner_key", auth.ownerKey)
      .not("claimed_at", "is", null);

    const linkedAppOwnerKeys = (data ?? [])
      .map((row) => row.app_owner_key)
      .filter((value): value is string => typeof value === "string" && value.length > 0);

    return {
      primaryOwner: {
        ownerKey: auth.ownerKey,
        ownerKind: auth.ownerKind,
        legacyTgUserId: auth.legacyTgUserId,
      },
      readOwnerKeys: Array.from(new Set([auth.ownerKey, ...linkedAppOwnerKeys])),
      legacyTgUserId: auth.legacyTgUserId,
    };
  }

  const primaryOwner = await getEffectiveOwner(auth);
  return {
    primaryOwner,
    readOwnerKeys: Array.from(new Set([auth.ownerKey, primaryOwner.ownerKey])),
    legacyTgUserId: primaryOwner.legacyTgUserId,
  };
}

export function buildOwnerReadFilter(scope: OwnerScope) {
  const filters = scope.readOwnerKeys.map((ownerKey) => `owner_key.eq.${ownerKey}`);
  if (scope.legacyTgUserId) {
    filters.push(`tg_user_id.eq.${scope.legacyTgUserId}`);
  }
  return filters.join(",");
}

export function generateLinkCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function legacyNativeTgUserId(ownerKey: string) {
  let hash = 0;
  for (let index = 0; index < ownerKey.length; index += 1) {
    hash = (hash * 31 + ownerKey.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}
