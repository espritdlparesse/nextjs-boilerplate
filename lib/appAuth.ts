import crypto from "crypto";
import { toBase64Url } from "@/lib/base64url";

type AppTokenPayload = {
  sub: string;
  kind: "app";
  deviceId: string;
  name?: string;
  iat: number;
};

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function signValue(value: string, secret: string) {
  return toBase64Url(crypto.createHmac("sha256", secret).update(value).digest());
}

function getSecret() {
  return process.env.EVERYYOU_APP_AUTH_SECRET ?? "";
}

export function createGuestAppUserId(deviceId: string) {
  return crypto.createHash("sha256").update(deviceId).digest("hex").slice(0, 24);
}

export function issueAppToken(input: { deviceId: string; name?: string }) {
  const secret = getSecret();
  if (!secret) {
    throw new Error("EVERYYOU_APP_AUTH_SECRET missing");
  }

  const payload: AppTokenPayload = {
    sub: `app:${createGuestAppUserId(input.deviceId)}`,
    kind: "app",
    deviceId: input.deviceId,
    name: input.name,
    iat: Date.now(),
  };

  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyAppToken(token: string) {
  const secret = getSecret();
  if (!secret) {
    return { ok: false as const, reason: "EVERYYOU_APP_AUTH_SECRET missing" };
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    return { ok: false as const, reason: "malformed token" };
  }

  const expectedSignature = signValue(encodedPayload, secret);
  const left = Buffer.from(signature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return { ok: false as const, reason: "bad signature" };
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as AppTokenPayload;
    if (payload.kind !== "app" || !payload.sub || !payload.deviceId) {
      return { ok: false as const, reason: "invalid payload" };
    }
    return { ok: true as const, payload };
  } catch {
    return { ok: false as const, reason: "bad payload json" };
  }
}
