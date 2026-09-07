import AsyncStorage from "@react-native-async-storage/async-storage";
import { clampText, getDisplayName, type TgUser } from "../shared/everyyou/domain";

export function isGuestSessionError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("bad signature") ||
    normalized.includes("missing auth") ||
    normalized.includes("expired") ||
    normalized.includes("invalid token") ||
    normalized.includes("401")
  );
}

export function splitDisplayName(name: string): TgUser {
  const normalized = clampText(name);
  if (!normalized) {
    return { first_name: "друг", last_name: "" };
  }

  const [firstName, ...rest] = normalized.split(" ");
  return {
    first_name: firstName,
    last_name: rest.join(" "),
  };
}

export async function loadJSON<T>(mainKey: string, legacyKeys: string[], fallback: T): Promise<T> {
  const mainRaw = await AsyncStorage.getItem(mainKey);
  if (mainRaw) {
    try {
      return JSON.parse(mainRaw) as T;
    } catch {
      return fallback;
    }
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (!legacyRaw) continue;
    try {
      const parsed = JSON.parse(legacyRaw) as T;
      await AsyncStorage.setItem(mainKey, JSON.stringify(parsed));
      return parsed;
    } catch {
      return fallback;
    }
  }

  return fallback;
}

export async function loadNumber(mainKey: string, legacyKeys: string[]) {
  const mainRaw = await AsyncStorage.getItem(mainKey);
  if (mainRaw != null) {
    const n = Number(mainRaw);
    return Number.isFinite(n) ? n : 0;
  }

  for (const legacyKey of legacyKeys) {
    const legacyRaw = await AsyncStorage.getItem(legacyKey);
    if (legacyRaw == null) continue;
    const n = Number(legacyRaw);
    if (Number.isFinite(n)) {
      await AsyncStorage.setItem(mainKey, String(n));
      return n;
    }
  }

  return 0;
}

export function hasValidCustomName(user: TgUser | null) {
  const normalized = getDisplayName(user).trim().toLowerCase();
  return normalized !== "друг" && normalized !== "ios friend" && normalized !== "ios друг";
}
