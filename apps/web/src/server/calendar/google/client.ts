import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { publicEnv, serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createGoogleCalendarApi, type GoogleCalendarApi } from "./api";
import {
  GoogleReauthRequiredError,
  refreshAccessToken,
  type GoogleOAuthClient,
  type GoogleTokens,
} from "./oauth";

/** Google の OAuth クライアント(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)が設定されているか */
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(serverEnv.googleClientId && serverEnv.googleClientSecret);
}

/**
 * OAuth クライアントの設定。未設定なら null。
 * 戻り先は NEXT_PUBLIC_APP_URL があればそれを、無ければリクエストの origin を使う
 * (Google Cloud に登録したリダイレクト URI と一致させる必要がある)。
 */
export function googleOAuthClient(requestOrigin?: string): GoogleOAuthClient | null {
  const { googleClientId, googleClientSecret } = serverEnv;
  if (!googleClientId || !googleClientSecret) return null;
  const base = process.env.NEXT_PUBLIC_APP_URL ? publicEnv.appUrl : (requestOrigin ?? publicEnv.appUrl);
  return {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
    redirectUri: `${base}/api/calendar/google/callback`,
  };
}

/** トークンを暗号化して保存する。refresh token が返ってこなかったときは前のものを残す */
export async function saveGoogleTokens(connectionId: string, tokens: GoogleTokens): Promise<void> {
  const admin = createAdminClient();
  const row: {
    connection_id: string;
    access_token_enc: string;
    expires_at: string;
    refresh_token_enc?: string;
  } = {
    connection_id: connectionId,
    access_token_enc: encryptSecret(tokens.accessToken),
    expires_at: tokens.expiresAt.toISOString(),
  };
  if (tokens.refreshToken) row.refresh_token_enc = encryptSecret(tokens.refreshToken);
  const { error } = await admin.from("calendar_tokens").upsert(row, { onConflict: "connection_id" });
  if (error) throw new Error(`トークンの保存に失敗しました: ${error.message}`);
}

/** 期限の何ミリ秒前に更新するか */
const REFRESH_MARGIN_MS = 3 * 60 * 1000;

/**
 * 有効なアクセストークンを返す。期限が近ければ refresh token で更新する。
 * refresh token が失効していたら、連携を「再連携が必要」にして GoogleReauthRequiredError を投げる。
 */
export async function getGoogleAccessToken(connectionId: string, force = false): Promise<string> {
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from("calendar_tokens")
    .select("*")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (error) throw new Error(`トークンの読み込みに失敗しました: ${error.message}`);

  if (
    !force &&
    row?.access_token_enc &&
    row.expires_at &&
    Date.parse(row.expires_at) - REFRESH_MARGIN_MS > Date.now()
  ) {
    return decryptSecret(row.access_token_enc);
  }

  if (!row?.refresh_token_enc) {
    await markNeedsReauth(connectionId, "refresh token がありません");
    throw new GoogleReauthRequiredError();
  }

  const client = googleOAuthClient();
  if (!client) throw new Error("GOOGLE_CLIENT_ID と GOOGLE_CLIENT_SECRET が設定されていません");

  try {
    const tokens = await refreshAccessToken(client, decryptSecret(row.refresh_token_enc));
    await saveGoogleTokens(connectionId, tokens);
    return tokens.accessToken;
  } catch (e) {
    if (e instanceof GoogleReauthRequiredError) await markNeedsReauth(connectionId, e.message);
    throw e;
  }
}

export async function markNeedsReauth(connectionId: string, reason: string): Promise<void> {
  await createAdminClient()
    .from("calendar_connections")
    .update({ status: "needs_reauth", last_error: reason })
    .eq("id", connectionId);
}

// ---------------------------------------------------------------------------
// 差し替え口
// ---------------------------------------------------------------------------

type GoogleApiFactory = (connectionId: string) => GoogleCalendarApi;

let overrideFactory: GoogleApiFactory | null = null;

/** Google API の実物の代わりを使う(テストや、認証情報の無い環境での動作確認用)。null で元に戻す */
export function setGoogleApiFactory(factory: GoogleApiFactory | null): void {
  overrideFactory = factory;
}

/** 接続のトークンで Google Calendar API を呼ぶクライアント */
export function googleApiForConnection(connectionId: string): GoogleCalendarApi {
  if (overrideFactory) return overrideFactory(connectionId);
  return createGoogleCalendarApi({ getAccessToken: (force) => getGoogleAccessToken(connectionId, force) });
}
