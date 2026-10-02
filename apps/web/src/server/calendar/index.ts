import "server-only";
import { NotImplementedError } from "@/server/not-implemented";

/** 外部カレンダー(担当: S3 カレンダー連携と取り込み) */

/** 接続の予定を差分で読み込み、external_events を更新する */
export async function syncConnection(connectionId: string): Promise<{ added: number; updated: number; removed: number }> {
  void connectionId;
  throw new NotImplementedError("syncConnection", "S3");
}

/**
 * 確定した予約を、予約ページで指定した外部カレンダーに書き込む。
 * 会議 URL(Google Meet)を発行した場合は返す。書き込み先が無ければ null を返す。
 */
export async function writeBookingEvent(
  bookingId: string,
): Promise<{ providerEventId: string; meetingUrl: string | null } | null> {
  void bookingId;
  throw new NotImplementedError("writeBookingEvent", "S3");
}

/** 日程変更などで、書き込んだ予定を更新する */
export async function updateBookingEvent(bookingId: string): Promise<void> {
  void bookingId;
  throw new NotImplementedError("updateBookingEvent", "S3");
}

/** キャンセル・辞退で、書き込んだ予定を消す */
export async function deleteBookingEvent(bookingId: string): Promise<void> {
  void bookingId;
  throw new NotImplementedError("deleteBookingEvent", "S3");
}
