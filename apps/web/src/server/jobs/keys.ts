/**
 * scheduled_jobs.dedupe_key の形。取り消しは前方一致で行うので、対象ごとに先頭をそろえる。
 *
 * - booking:<予約 ID>:reminder:<分>          メールのリマインド
 * - booking:<予約 ID>:automation:<ID>        予約に対する時刻型のオートメーション
 * - event:<外部予定 ID>:automation:<ID>      反映中の外部予定に対する時刻型のオートメーション
 * - automation:<ID>:daily:<YYYY-MM-DD>       毎日のオートメーション(ホストのタイムゾーンの日付)
 * - booking-trigger:<予約 ID>:<created|cancelled>:<ID>  予約が入った・キャンセルされたときのオートメーション
 * - user:<ユーザー ID>:sync                  端末にローカル通知を張り直させるサイレントなプッシュ
 * - user:<ユーザー ID>:automations:reschedule  オートメーションのジョブの入れ直し(DB のトリガーが入れる)
 */

export const jobKeys = {
  bookingPrefix: (bookingId: string) => `booking:${bookingId}:`,
  bookingReminder: (bookingId: string, minutes: number) => `booking:${bookingId}:reminder:${minutes}`,
  bookingAutomation: (bookingId: string, automationId: string) => `booking:${bookingId}:automation:${automationId}`,
  eventPrefix: (eventId: string) => `event:${eventId}:`,
  eventAutomation: (eventId: string, automationId: string) => `event:${eventId}:automation:${automationId}`,
  dailyPrefix: (automationId: string) => `automation:${automationId}:daily:`,
  daily: (automationId: string, localDate: string) => `automation:${automationId}:daily:${localDate}`,
  bookingTrigger: (bookingId: string, event: "created" | "cancelled", automationId: string) =>
    `booking-trigger:${bookingId}:${event}:${automationId}`,
  userSync: (userId: string) => `user:${userId}:sync`,
  userReschedule: (userId: string) => `user:${userId}:automations:reschedule`,
};

/** 時刻型・毎日のオートメーションのジョブか(ユーザー単位の入れ直しで、要らなくなったものを取り消す対象) */
export function isPlannedAutomationKey(key: string): boolean {
  return /^(booking|event):[^:]+:automation:[^:]+$/.test(key) || /^automation:[^:]+:daily:[^:]+$/.test(key);
}

/** LIKE の前方一致に使えるよう、% と _ と \ を逃がす */
export function likePrefix(prefix: string): string {
  return `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
