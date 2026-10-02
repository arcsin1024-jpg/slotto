import "server-only";
import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildNotificationMessages,
  buildSyncMessages,
  chunk,
  EXPO_BATCH_SIZE,
  EXPO_PUSH_URL,
  readTickets,
  type ExpoPushMessage,
  type ExpoTicket,
} from "./expo";

/** アプリへのプッシュ通知(担当: S4 実行基盤) */

export interface PushMessage {
  title: string;
  body?: string;
  /** アプリが受け取るデータ。例: { type: "booking", id: "..." }、{ type: "open_url", url: "..." } */
  data?: Record<string, unknown>;
  /** アラームとして鳴らす(Android はアラーム用のチャンネル、iOS は時間厳守の通知) */
  alarm?: boolean;
  /** Android の通知チャンネル。省略時はオートメーションの結果のチャンネル(PUSH_CHANNELS) */
  channelId?: string;
}

export interface PushResult {
  sent: number;
  /** 送らなかった理由。not_configured: EXPO_ACCESS_TOKEN が未設定 / no_devices: 端末が無い */
  skipped?: "not_configured" | "no_devices";
  /** Expo が受け付けなかった件数の理由 */
  errors?: string[];
}

async function deviceTokens(userId: string): Promise<string[]> {
  const { data, error } = await createAdminClient().from("push_devices").select("expo_push_token").eq("user_id", userId);
  if (error) throw new Error(`push_devices を読めません: ${error.message}`);
  return (data ?? []).map((row) => row.expo_push_token);
}

/** Expo に送り、無効になったトークンを push_devices から消す */
async function deliver(messages: ExpoPushMessage[]): Promise<PushResult> {
  const token = serverEnv.expoAccessToken;
  if (!token) {
    console.info(`[push] EXPO_ACCESS_TOKEN が未設定のため送りません(${messages.length} 件)`);
    return { sent: 0, skipped: "not_configured" };
  }

  let sent = 0;
  const errors: string[] = [];
  const invalidTokens: string[] = [];
  for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Expo Push が ${response.status} を返しました`);
    }
    const json = (await response.json()) as { data?: ExpoTicket[]; errors?: Array<{ message: string }> };
    if (!json.data) throw new Error(`Expo Push の応答が読めません: ${json.errors?.[0]?.message ?? "不明"}`);
    const result = readTickets(batch, json.data);
    sent += result.ok;
    errors.push(...result.errors);
    invalidTokens.push(...result.invalidTokens);
  }

  if (invalidTokens.length > 0) {
    const { error } = await createAdminClient().from("push_devices").delete().in("expo_push_token", invalidTokens);
    if (error) console.error("[push] 無効なトークンを消せませんでした", error.message);
  }
  return errors.length > 0 ? { sent, errors } : { sent };
}

/** ユーザーの全端末に送る。端末が無ければ何もしない */
export async function sendPush(userId: string, message: PushMessage): Promise<PushResult> {
  const tokens = await deviceTokens(userId);
  if (tokens.length === 0) return { sent: 0, skipped: "no_devices" };
  return deliver(buildNotificationMessages(tokens, message));
}

/**
 * 表示しないプッシュ。予定の追加・変更・キャンセルをアプリに知らせ、ローカル通知を張り直させる。
 * data は { type: "sync", reason }。直接呼ばず、@/server/jobs の requestDeviceSync を使う(まとめて 1 回にするため)。
 */
export async function sendSyncPush(userId: string, reason: string): Promise<PushResult> {
  const tokens = await deviceTokens(userId);
  if (tokens.length === 0) return { sent: 0, skipped: "no_devices" };
  return deliver(buildSyncMessages(tokens, reason));
}
