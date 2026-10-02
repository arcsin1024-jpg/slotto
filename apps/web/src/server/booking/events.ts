import "server-only";
import type { BookingEventRow, Json, TablesInsert } from "@slotto/core/database";
import type { AdminClient } from "./data";

/**
 * 予約の履歴(booking_events)。
 * email_sent と failed は 20261003000000_create_booking.sql で足した種類
 * (packages/core/src/database.ts への追加は S0 に依頼している)。
 */
export type BookingEventType = BookingEventRow["type"] | "email_sent" | "failed";

export async function recordEvent(
  db: AdminClient,
  bookingId: string,
  type: BookingEventType,
  actor: BookingEventRow["actor"],
  data: Record<string, Json | undefined> = {},
): Promise<void> {
  const row = { booking_id: bookingId, type, actor, data } as TablesInsert<"booking_events">;
  const { error } = await db.from("booking_events").insert(row);
  if (error) console.error(`[booking] 履歴(${type})を記録できませんでした(予約 ${bookingId})`, error);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 予約の後処理(カレンダー、メール、ジョブ、通知)を 1 つ実行する。
 * 失敗しても予約自体は失敗させず、ログに出して履歴に failed として残す。
 */
export async function safely<T>(
  db: AdminClient,
  bookingId: string,
  step: string,
  run: () => Promise<T>,
): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    console.error(`[booking] 後処理「${step}」に失敗しました(予約 ${bookingId})`, error);
    await recordEvent(db, bookingId, "failed", "system", { step, message: errorMessage(error).slice(0, 500) });
    return undefined;
  }
}
