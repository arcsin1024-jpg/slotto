/**
 * Expo Push Service のメッセージの組み立てと、応答(チケット)の読み取り。純粋な関数だけを置く。
 * https://exp.host/--/api/v2/push/send に、1 回 100 件までの配列で送る。
 */

export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
export const EXPO_BATCH_SIZE = 100;

/**
 * Android の通知チャンネル(アプリ側 S6 が同じ ID で作る)。
 * - event-alarm: アラーム(重要度 HIGH、専用の音)
 * - event-reminder: 予定の通知
 * - automation-result: オートメーションの結果
 */
export const PUSH_CHANNELS = {
  alarm: "event-alarm",
  reminder: "event-reminder",
  automation: "automation-result",
} as const;

export interface ExpoPushMessage {
  to: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  priority?: "default" | "normal" | "high";
  channelId?: string;
  interruptionLevel?: "active" | "critical" | "passive" | "time-sensitive";
  /** iOS: アプリをバックグラウンドで起こす(サイレントなプッシュ) */
  _contentAvailable?: boolean;
  ttl?: number;
}

export type ExpoTicket =
  | { status: "ok"; id: string }
  | { status: "error"; message: string; details?: { error?: string } };

const TOKEN_PATTERN = /^Expo(nent)?PushToken\[[^\]\s]{10,}\]$/;

export function isExpoPushToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

export interface NotificationContent {
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  alarm?: boolean;
  channelId?: string;
}

/** 表示する通知 */
export function buildNotificationMessages(tokens: string[], content: NotificationContent): ExpoPushMessage[] {
  return tokens.map((to) => ({
    to,
    title: content.title,
    ...(content.body ? { body: content.body } : {}),
    ...(content.data ? { data: content.data } : {}),
    sound: "default",
    priority: "high",
    channelId: content.alarm ? PUSH_CHANNELS.alarm : (content.channelId ?? PUSH_CHANNELS.automation),
    interruptionLevel: content.alarm ? "time-sensitive" : "active",
  }));
}

/** 表示しない通知。アプリに予定の変化を知らせ、ローカル通知を張り直させる */
export function buildSyncMessages(tokens: string[], reason: string): ExpoPushMessage[] {
  return tokens.map((to) => ({
    to,
    data: { type: "sync", reason },
    _contentAvailable: true,
    priority: "normal",
    // 古い同期の知らせは意味がないので、1 時間で捨てる
    ttl: 3600,
  }));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** チケットを読み、成功数と、無効になったトークンを返す(チケットは送った順に並ぶ) */
export function readTickets(messages: ExpoPushMessage[], tickets: ExpoTicket[]): { ok: number; invalidTokens: string[]; errors: string[] } {
  let ok = 0;
  const invalidTokens: string[] = [];
  const errors: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status === "ok") {
      ok++;
      return;
    }
    const to = messages[index]?.to;
    if (ticket.details?.error === "DeviceNotRegistered" && to) invalidTokens.push(to);
    else errors.push(ticket.details?.error ?? ticket.message);
  });
  return { ok, invalidTokens, errors };
}
