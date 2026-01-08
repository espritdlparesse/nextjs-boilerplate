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
