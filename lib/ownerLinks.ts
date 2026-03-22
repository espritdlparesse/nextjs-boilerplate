import { resolveApiIdentity, type ApiIdentity } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type EffectiveOwner = {
  ownerKey: string;
  ownerKind: "telegram" | "app";
  legacyTgUserId?: number;
};

export type { EffectiveOwner };

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

export function generateLinkCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}
