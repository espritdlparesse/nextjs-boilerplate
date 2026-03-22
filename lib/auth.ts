import { NextRequest } from "next/server";
import { verifyAppToken } from "@/lib/appAuth";
import { verifyTelegramInitData } from "@/lib/telegram";

export type ApiIdentity =
  | {
      ok: true;
      authType: "telegram";
      ownerKey: string;
      ownerKind: "telegram";
      legacyTgUserId: number;
      tgUsername?: string | null;
      tgFirstName?: string | null;
      tgLastName?: string | null;
    }
  | {
      ok: true;
      authType: "app";
      ownerKey: string;
      ownerKind: "app";
      appUserId: string;
      deviceId: string;
      name?: string;
    }
  | {
      ok: false;
      status: number;
      message: string;
    };

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return "";
  return token;
}

function getTelegramIdentity(req: NextRequest): ApiIdentity | null {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  if (!initData) return null;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return { ok: false, status: 500, message: "TELEGRAM_BOT_TOKEN missing" };
  }

  const verified = verifyTelegramInitData(initData, botToken);
  if (!verified.ok) {
    return { ok: false, status: 401, message: `tg auth failed: ${verified.reason}` };
  }

  const tgUserId = verified.user?.id;
  if (!tgUserId) {
    return { ok: false, status: 401, message: "tg user missing" };
  }

  return {
    ok: true,
    authType: "telegram",
    ownerKind: "telegram",
    ownerKey: `tg:${Number(tgUserId)}`,
    legacyTgUserId: Number(tgUserId),
    tgUsername: verified.user?.username ?? null,
    tgFirstName: verified.user?.first_name ?? null,
    tgLastName: verified.user?.last_name ?? null,
  };
}

function getAppIdentity(req: NextRequest): ApiIdentity | null {
  const token = getBearerToken(req);
  if (!token) return null;

  const verified = verifyAppToken(token);
  if (!verified.ok) {
    return { ok: false, status: 401, message: `app auth failed: ${verified.reason}` };
  }

  return {
    ok: true,
    authType: "app",
    ownerKind: "app",
    ownerKey: verified.payload.sub,
    appUserId: verified.payload.sub.slice("app:".length),
    deviceId: verified.payload.deviceId,
    name: verified.payload.name,
  };
}

export function resolveApiIdentity(req: NextRequest): ApiIdentity {
  const appIdentity = getAppIdentity(req);
  if (appIdentity) return appIdentity;

  const telegramIdentity = getTelegramIdentity(req);
  if (telegramIdentity) return telegramIdentity;

  return {
    ok: false,
    status: 401,
    message: "missing auth: use Authorization Bearer token or x-telegram-init-data",
  };
}
