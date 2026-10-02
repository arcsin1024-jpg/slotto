import "server-only";
import { cancelJobs, enqueueJob, type EnqueueJobInput } from "@/server/jobs";

/**
 * 同期と変更通知の更新のジョブ(実行は S4 の実行基盤)。
 *
 * dedupe_key の決め方:
 * - 定期の同期: 6 時間ごとの区切りの時刻をキーに入れる。誰が「次の定期同期」を入れても同じキーになるので、
 *   同期の流れが 1 本にまとまる。実行中のジョブが自分と同じキーを上書きすることもない
 * - 変更通知からの同期: 30 秒ごとの区切りをキーに入れ、続けて届いた通知を 1 回の同期にまとめる
 * - 変更通知の更新: チャンネルの期限をキーに入れる
 */

export const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;
const PUSH_DEBOUNCE_MS = 30 * 1000;
/** 変更通知のチャンネルを、期限の何ミリ秒前に張り直すか */
export const WATCH_RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export interface CalendarSyncJobPayload {
  connectionId: string;
  reason: "poll" | "push" | "manual";
}

export interface CalendarWatchRenewJobPayload {
  calendarId: string;
}

export const syncJobKeyPrefix = (connectionId: string) => `calendar_sync:${connectionId}:`;
export const watchJobKeyPrefix = (calendarId: string) => `calendar_watch_renew:${calendarId}:`;

/** 次の定期同期を入れる */
export async function scheduleNextPoll(connectionId: string, userId: string, now = new Date()): Promise<void> {
  const slot = new Date((Math.floor(now.getTime() / POLL_INTERVAL_MS) + 1) * POLL_INTERVAL_MS);
  await safeEnqueue({
    kind: "calendar_sync",
    runAt: slot,
    userId,
    payload: { connectionId, reason: "poll" } satisfies CalendarSyncJobPayload,
    dedupeKey: `${syncJobKeyPrefix(connectionId)}poll:${slot.toISOString()}`,
  });
}

/** 変更通知を受けたときの同期を入れる(少し待ってからまとめて行う) */
export async function schedulePushSync(connectionId: string, userId: string, now = new Date()): Promise<void> {
  const bucket = Math.floor(now.getTime() / PUSH_DEBOUNCE_MS) + 1;
  const runAt = new Date(bucket * PUSH_DEBOUNCE_MS);
  await safeEnqueue({
    kind: "calendar_sync",
    runAt,
    userId,
    payload: { connectionId, reason: "push" } satisfies CalendarSyncJobPayload,
    dedupeKey: `${syncJobKeyPrefix(connectionId)}push:${runAt.toISOString()}`,
  });
}

export async function scheduleWatchRenew(calendarId: string, userId: string, expiresAt: Date): Promise<void> {
  await safeEnqueue({
    kind: "calendar_watch_renew",
    runAt: new Date(Math.max(Date.now(), expiresAt.getTime() - WATCH_RENEW_BEFORE_MS)),
    userId,
    payload: { calendarId } satisfies CalendarWatchRenewJobPayload,
    dedupeKey: `${watchJobKeyPrefix(calendarId)}${expiresAt.toISOString()}`,
  });
}

export async function cancelConnectionJobs(connectionId: string, calendarIds: string[]): Promise<void> {
  await safeCancel(syncJobKeyPrefix(connectionId));
  for (const id of calendarIds) await safeCancel(watchJobKeyPrefix(id));
}

export async function cancelWatchJobs(calendarId: string): Promise<void> {
  await safeCancel(watchJobKeyPrefix(calendarId));
}

/**
 * ジョブの登録に失敗しても、連携や同期そのものは止めない(定期の同期が入らないだけ)。
 * 実行基盤(S4)が未実装の間は NotImplementedError になる。
 */
async function safeEnqueue(input: EnqueueJobInput): Promise<void> {
  try {
    await enqueueJob(input);
  } catch (e) {
    console.warn(`[calendar] ジョブを登録できませんでした(${input.dedupeKey}):`, errorMessage(e));
  }
}

async function safeCancel(prefix: string): Promise<void> {
  try {
    await cancelJobs(prefix);
  } catch (e) {
    console.warn(`[calendar] ジョブを取り消せませんでした(${prefix}):`, errorMessage(e));
  }
}

export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
