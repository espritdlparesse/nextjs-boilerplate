
import { telegramInitData } from "@/lib/telegramWebApp";

export function getTgInitData(): string {
  return telegramInitData();
}

export async function safeJson(res: Response) {
  try { return await res.json(); } catch { return {}; }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    "x-telegram-init-data": getTgInitData(),
    ...(init.body ? { "Content-Type": "application/json" } : {}),
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(path, { ...init, headers });
  return { res, json: await safeJson(res) };
}
