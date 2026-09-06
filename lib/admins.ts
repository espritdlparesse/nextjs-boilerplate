import { verifyTelegramInitData } from "@/lib/telegram";

const BUILT_IN_ADMIN_TG_IDS = [394657396, 444263882];

export const ADMIN_TG_IDS = Array.from(
  new Set([
    ...BUILT_IN_ADMIN_TG_IDS,
    ...(process.env.ADMIN_TG_ID ?? "")
      .split(",")
      .map((id) => Number(id.trim()))
      .filter((id) => Number.isFinite(id) && id > 0),
  ])
);

export function isAdminTgId(tgUserId: number | string | null | undefined) {
  return ADMIN_TG_IDS.includes(Number(tgUserId));
}

export function isAdminRequest(req: { headers: { get(name: string): string | null } }) {
  const verified = verifyTelegramInitData(
    req.headers.get("x-telegram-init-data") ?? "",
    process.env.TELEGRAM_BOT_TOKEN!
  );
  return verified.ok && isAdminTgId(verified.user?.id);
}
