import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

/**
 * OAuth の state。誰の連携か、PKCE の verifier、戻り先を暗号化して入れる。
 * 暗号化(認証付き)なので、書き換えや他人の state の作成はできない。
 * Cookie を使わないので、アプリがシステムのブラウザで開いた場合でも使える。
 */

export interface OAuthState {
  userId: string;
  verifier: string;
  /** 連携後に戻る先。サイト内のパスか、アプリのディープリンク(slotto://) */
  returnTo: string;
  /** 期限(ミリ秒) */
  exp: number;
}

const TTL_MS = 15 * 60 * 1000;

export function encodeOAuthState(input: Omit<OAuthState, "exp">): string {
  return encryptSecret(JSON.stringify({ ...input, exp: Date.now() + TTL_MS }));
}

export function decodeOAuthState(value: string | null): OAuthState | null {
  if (!value) return null;
  try {
    const state = JSON.parse(decryptSecret(value)) as OAuthState;
    if (typeof state.userId !== "string" || typeof state.verifier !== "string") return null;
    if (typeof state.exp !== "number" || state.exp < Date.now()) return null;
    return { ...state, returnTo: safeReturnTo(state.returnTo) };
  } catch {
    return null;
  }
}

/** 戻り先として許すもの: サイト内のパス、またはアプリのディープリンク */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value) return "/app/integrations";
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  if (value.startsWith("slotto://")) return value;
  return "/app/integrations";
}
