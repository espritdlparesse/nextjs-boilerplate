import crypto from "crypto";
import { toBase64Url } from "@/lib/base64url";

type SpotifyOAuthState = {
  ownerKey: string;
  ownerKind: "telegram" | "app";
  issuedAt: number;
};

function getSecret() {
  const secret = process.env.EVERYYOU_APP_AUTH_SECRET;
  if (!secret) throw new Error("EVERYYOU_APP_AUTH_SECRET missing");
  return secret;
}

function fromBase64Url(input: string) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  return Buffer.from(normalized + padding, "base64");
}

function sign(encodedPayload: string) {
  return toBase64Url(crypto.createHmac("sha256", getSecret()).update(encodedPayload).digest());
}

export function createSpotifyOAuthState(input: Omit<SpotifyOAuthState, "issuedAt">) {
  const payload: SpotifyOAuthState = {
    ...input,
    issuedAt: Date.now(),
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${sign(encoded)}`;
}

export function verifySpotifyOAuthState(value: string) {
  const [encodedPayload, signature] = value.split(".");
  if (!encodedPayload || !signature) throw new Error("malformed spotify state");

  const expected = sign(encodedPayload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new Error("invalid spotify state signature");
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload).toString("utf8")) as SpotifyOAuthState;
  if (!payload.ownerKey || !payload.ownerKind) {
    throw new Error("invalid spotify state payload");
  }

  return payload;
}
