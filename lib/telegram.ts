import crypto from "crypto";

function parseInitData(initData: string) {
  const params = new URLSearchParams(initData);
  const data: Record<string, string> = {};
  params.forEach((v, k) => (data[k] = v));
  return data;
}

export function verifyTelegramInitData(initData: string, botToken: string) {
  const data = parseInitData(initData);

  const receivedHash = data.hash;
  if (!receivedHash) return { ok: false as const, reason: "no hash" };

  const checkPairs: string[] = [];
  Object.keys(data)
    .filter((k) => k !== "hash")
    .sort()
    .forEach((k) => checkPairs.push(`${k}=${data[k]}`));

  const dataCheckString = checkPairs.join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(botToken)
    .digest();

  const calculatedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  const ok = crypto.timingSafeEqual(
    Buffer.from(calculatedHash),
    Buffer.from(receivedHash)
  );

  if (!ok) return { ok: false as const, reason: "bad hash" };

  const userRaw = data.user ? JSON.parse(data.user) : null;

  return { ok: true as const, data, user: userRaw };
}

export function getTgUserIdOrThrow(req: { headers: { get(name: string): string | null } }) {
  const initData = req.headers.get("x-telegram-init-data") ?? "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (process.env.NODE_ENV === "production") {
    if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN missing");
    const verified = verifyTelegramInitData(initData, botToken);
    if (!verified.ok) throw new Error(`tg auth failed: ${verified.reason}`);
    if (!verified.user?.id) throw new Error("tg user missing");
    return Number(verified.user.id);
  }

  if (initData && botToken) {
    const verified = verifyTelegramInitData(initData, botToken);
    if (verified.ok && verified.user?.id) return Number(verified.user.id);
  }

  const devTgUserId = process.env.DEV_TG_USER_ID;
  if (!devTgUserId) throw new Error("No Telegram init data. Set DEV_TG_USER_ID in .env.local to test locally.");
  return Number(devTgUserId);
}
