import "server-only";
import { decryptSecret } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleOAuthClient, saveGoogleTokens } from "./google/client";
import {
  buildAuthorizationUrl,
  createPkcePair,
  exchangeAuthorizationCode,
  hasRequiredScopes,
  revokeToken,
} from "./google/oauth";
import { decodeOAuthState, encodeOAuthState, safeReturnTo } from "./google/state";
import { cancelConnectionJobs, errorMessage } from "./schedule";
import { afterSync, syncConnection } from "./sync";
import { ensureCalendarWatch, stopCalendarWatch } from "./watch";

/** 連携の失敗の種類。画面ではこれを見て文言を出す(戻り先の ?calendar_error=) */
export type ConnectErrorCode =
  | "not_configured"
  | "denied"
  | "invalid_state"
  | "scope_missing"
  | "no_refresh_token"
  | "exchange_failed";

export class ConnectError extends Error {
  constructor(
    readonly code: ConnectErrorCode,
    message: string,
    /** 戻り先(state を読めた場合) */
    readonly returnTo: string | null = null,
  ) {
    super(message);
    this.name = "ConnectError";
  }
}

/** Google の同意画面の URL を作る */
export function startGoogleConnect(input: {
  userId: string;
  returnTo?: string | null;
  loginHint?: string | null;
  requestOrigin: string;
}): string {
  const client = googleOAuthClient(input.requestOrigin);
  if (!client) {
    throw new ConnectError("not_configured", "Google カレンダー連携の設定(GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)が必要です");
  }
  const pkce = createPkcePair();
  const state = encodeOAuthState({
    userId: input.userId,
    verifier: pkce.verifier,
    returnTo: safeReturnTo(input.returnTo),
  });
  return buildAuthorizationUrl(client, {
    state,
    codeChallenge: pkce.challenge,
    loginHint: input.loginHint ?? undefined,
  });
}

/**
 * Google から戻ってきたときの処理。トークンを暗号化して保存し、最初の同期を行う。
 * sessionUserId: ブラウザにログイン中のユーザー(アプリから開いた場合は null)。state の持ち主と違えば断る。
 */
export async function completeGoogleConnect(input: {
  code: string | null;
  state: string | null;
  error: string | null;
  sessionUserId: string | null;
  requestOrigin: string;
}): Promise<{ returnTo: string; connectionId: string; synced: boolean }> {
  const state = decodeOAuthState(input.state);
  if (!state) throw new ConnectError("invalid_state", "連携の手続きの期限が切れたか、正しくありません。もう一度お試しください");
  const fail = (code: ConnectErrorCode, message: string) => new ConnectError(code, message, state.returnTo);

  if (input.sessionUserId && input.sessionUserId !== state.userId) {
    throw fail("invalid_state", "ログイン中のアカウントと、連携を始めたアカウントが違います");
  }
  if (input.error || !input.code) throw fail("denied", "Google での許可がされませんでした");

  const client = googleOAuthClient(input.requestOrigin);
  if (!client) throw fail("not_configured", "Google カレンダー連携の設定が必要です");

  let tokens;
  try {
    tokens = await exchangeAuthorizationCode(client, input.code, state.verifier);
  } catch (e) {
    throw fail("exchange_failed", errorMessage(e));
  }
  if (!hasRequiredScopes(tokens.scopes)) {
    await revokeToken(tokens.accessToken);
    throw fail("scope_missing", "カレンダーへのアクセスが許可されていません。同意画面ですべての項目にチェックを入れてください");
  }
  if (!tokens.account) throw fail("exchange_failed", "Google アカウントを確認できませんでした");

  const admin = createAdminClient();
  const { data: connection, error } = await admin
    .from("calendar_connections")
    .upsert(
      {
        user_id: state.userId,
        provider: "google",
        account_email: tokens.account.email,
        display_name: tokens.account.name,
        status: "active",
        scopes: tokens.scopes,
        last_error: null,
      },
      { onConflict: "user_id,provider,account_email" },
    )
    .select("id")
    .single();
  if (error || !connection) throw new Error(`接続の保存に失敗しました: ${error?.message}`);

  if (!tokens.refreshToken) {
    // prompt=consent を付けているので通常は返る。返らなければ前回の refresh token が残っているかを見る
    const { data: existing } = await admin
      .from("calendar_tokens")
      .select("refresh_token_enc")
      .eq("connection_id", connection.id)
      .maybeSingle();
    if (!existing?.refresh_token_enc) {
      throw fail("no_refresh_token", "Google から更新用のトークンを受け取れませんでした。もう一度連携してください");
    }
  }
  await saveGoogleTokens(connection.id, tokens);

  let synced = false;
  try {
    await syncConnection(connection.id);
    synced = true;
    await afterSync(connection.id, state.userId);
  } catch (e) {
    // 最初の同期に失敗しても連携は完了とする(定期の同期や手動の同期でやり直せる)
    console.warn("[calendar] 連携直後の同期に失敗しました:", errorMessage(e));
  }
  return { returnTo: state.returnTo, connectionId: connection.id, synced };
}

/** 連携を解除する。Google 側のトークンも取り消し、取り込んだ予定も消す */
export async function disconnectConnection(userId: string, connectionId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("calendar_connections")
    .select("id, user_id")
    .eq("id", connectionId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!connection) return false;

  const { data: calendars } = await admin.from("external_calendars").select("id").eq("connection_id", connectionId);
  const calendarIds = (calendars ?? []).map((c) => c.id);
  for (const id of calendarIds) await stopCalendarWatch(id).catch(() => undefined);
  await cancelConnectionJobs(connectionId, calendarIds);

  const { data: token } = await admin
    .from("calendar_tokens")
    .select("refresh_token_enc")
    .eq("connection_id", connectionId)
    .maybeSingle();
  if (token?.refresh_token_enc) {
    try {
      await revokeToken(decryptSecret(token.refresh_token_enc));
    } catch (e) {
      console.warn("[calendar] トークンを取り消せませんでした:", errorMessage(e));
    }
  }

  // カレンダー、予定、トークン、同期の状態は外部キーでまとめて消える
  const { error } = await admin.from("calendar_connections").delete().eq("id", connectionId);
  if (error) throw new Error(`接続の削除に失敗しました: ${error.message}`);
  return true;
}

/**
 * カレンダーごとの設定を変える。
 * 表示をオフにしたら、そのカレンダーの予定を消す(空き時間の計算から外れる)。オンにしたら読み込み直す。
 */
export async function updateCalendarSettings(
  userId: string,
  calendarId: string,
  values: { is_enabled?: boolean; auto_select_new?: boolean },
): Promise<{ id: string; is_enabled: boolean; auto_select_new: boolean } | null> {
  const admin = createAdminClient();
  const { data: before } = await admin
    .from("external_calendars")
    .select("id, connection_id, is_enabled")
    .eq("id", calendarId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!before) return null;

  const { data: after, error } = await admin
    .from("external_calendars")
    .update(values)
    .eq("id", calendarId)
    .select("id, is_enabled, auto_select_new")
    .single();
  if (error || !after) throw new Error(`カレンダーの設定の保存に失敗しました: ${error?.message}`);

  if (before.is_enabled && !after.is_enabled) {
    await admin.from("external_events").delete().eq("calendar_id", calendarId);
    await stopCalendarWatch(calendarId).catch(() => undefined);
  } else if (!before.is_enabled && after.is_enabled) {
    try {
      await syncConnection(before.connection_id);
      await ensureCalendarWatch(calendarId);
    } catch (e) {
      console.warn("[calendar] カレンダーの読み込みに失敗しました:", errorMessage(e));
    }
  }
  return after;
}
