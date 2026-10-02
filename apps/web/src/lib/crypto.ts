import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * 外部カレンダーのトークンや接続先の API キーを、DB に入れる前に暗号化する(AES-256-GCM)。
 * 形式: "v1:<iv>:<tag>:<本文>"(いずれも base64url)
 */

function key(): Buffer {
  const buffer = Buffer.from(serverEnv.tokenEncryptionKey, "base64");
  if (buffer.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY は 32 バイトを base64 にした値にしてください");
  return buffer;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), body.toString("base64url")].join(":");
}

export function decryptSecret(value: string): string {
  const [version, iv, tag, body] = value.split(":");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("暗号化された値の形式が正しくありません");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}
