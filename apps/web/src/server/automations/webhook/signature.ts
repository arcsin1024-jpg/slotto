import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Webhook の署名(Standard Webhooks に準拠)。
 * - ヘッダ: webhook-id / webhook-timestamp(Unix 秒)/ webhook-signature
 * - 署名対象: `{id}.{timestamp}.{本文}`。HMAC-SHA256 を base64 にし、`v1,` を前置する
 * - 秘密の値: `whsec_` + 24〜64 バイトの乱数の base64
 */

export const WEBHOOK_SECRET_PREFIX = "whsec_";

export function generateWebhookSecret(): string {
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes(32).toString("base64")}`;
}

/** 秘密の値を鍵のバイト列にする。whsec_ で始まれば base64 を戻し、そうでなければ文字列のまま使う */
export function webhookSecretKey(secret: string): Buffer {
  if (secret.startsWith(WEBHOOK_SECRET_PREFIX)) {
    const key = Buffer.from(secret.slice(WEBHOOK_SECRET_PREFIX.length), "base64");
    if (key.length > 0) return key;
  }
  return Buffer.from(secret, "utf8");
}

export function signWebhook(input: { id: string; timestamp: number; body: string; secret: string }): string {
  const mac = createHmac("sha256", webhookSecretKey(input.secret))
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest("base64");
  return `v1,${mac}`;
}

/** 受信側の検証(テストと、受け取る側への説明用)。tolerance は秒 */
export function verifyWebhook(input: {
  id: string;
  timestamp: number;
  body: string;
  secret: string;
  signatureHeader: string;
  now?: number;
  toleranceSeconds?: number;
}): boolean {
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - input.timestamp) > (input.toleranceSeconds ?? 300)) return false;
  const expected = Buffer.from(signWebhook(input));
  return input.signatureHeader.split(" ").some((candidate) => {
    const actual = Buffer.from(candidate);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

/** 同じ配信なら同じ値になる webhook-id(再送でも変えない。受信側が重複を除ける) */
export function webhookIdFor(idempotencyKey: string): string {
  return `msg_${createHash("sha256").update(idempotencyKey).digest("hex").slice(0, 32)}`;
}

export function webhookHeaders(input: { id: string; timestamp: number; body: string; secret: string }) {
  return {
    "webhook-id": input.id,
    "webhook-timestamp": String(input.timestamp),
    "webhook-signature": signWebhook(input),
  };
}
