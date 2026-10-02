import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleReauthRequiredError } from "./google/oauth";
import type { CalendarSyncJobPayload, CalendarWatchRenewJobPayload } from "./schedule";
import { afterSync, syncConnection } from "./sync";
import { ensureCalendarWatch } from "./watch";

/** 外部カレンダー(担当: S3 カレンダー連携と取り込み) */

/** 接続の予定を差分で読み込み、external_events を更新する */
export { syncConnection } from "./sync";

/**
 * 確定した予約を、予約ページで指定した外部カレンダーに書き込む。
 * 会議 URL(Google Meet)を発行した場合は返す。書き込み先が無ければ null を返す。
 * 書き込んだ予定の ID・カレンダー・会議 URL は bookings にも保存する。
 *
 * 日程変更などで、書き込んだ予定を更新する: updateBookingEvent
 * キャンセル・辞退で、書き込んだ予定を消す: deleteBookingEvent
 */
export { deleteBookingEvent, updateBookingEvent, writeBookingEvent } from "./booking-events";

export { applyEventSelection, markEventsSeen } from "./selection";
export { isGoogleCalendarConfigured, setGoogleApiFactory } from "./google/client";
export { GoogleReauthRequiredError } from "./google/oauth";

// ---------------------------------------------------------------------------
// ジョブの実行側(S4 の実行基盤)から呼ぶ関数
// ---------------------------------------------------------------------------

/**
 * kind: "calendar_sync" のジョブ。payload は { connectionId, reason }。
 * 同期のあと、変更通知を張り直し、次の定期同期を入れる。
 * 連携が切れている・接続が消えている場合は、再試行しても無駄なので投げずに終える。
 */
export async function runCalendarSyncJob(payload: unknown): Promise<void> {
  const { connectionId } = (payload ?? {}) as Partial<CalendarSyncJobPayload>;
  if (typeof connectionId !== "string") throw new Error("calendar_sync の payload に connectionId がありません");

  const { data: connection } = await createAdminClient()
    .from("calendar_connections")
    .select("id, user_id, status")
    .eq("id", connectionId)
    .maybeSingle();
  if (!connection || connection.status !== "active") return;

  try {
    await syncConnection(connectionId);
  } catch (e) {
    if (e instanceof GoogleReauthRequiredError) return;
    throw e;
  }
  await afterSync(connectionId, connection.user_id);
}

/** kind: "calendar_watch_renew" のジョブ。payload は { calendarId }。変更通知のチャンネルを張り直す */
export async function runCalendarWatchRenewJob(payload: unknown): Promise<void> {
  const { calendarId } = (payload ?? {}) as Partial<CalendarWatchRenewJobPayload>;
  if (typeof calendarId !== "string") throw new Error("calendar_watch_renew の payload に calendarId がありません");
  try {
    await ensureCalendarWatch(calendarId, { force: true });
  } catch (e) {
    if (e instanceof GoogleReauthRequiredError) return;
    throw e;
  }
}
