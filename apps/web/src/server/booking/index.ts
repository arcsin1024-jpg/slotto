import "server-only";
import type { BookingAnswers, CreateBookingInput } from "@slotto/core";
import type { BookingRow } from "@slotto/core/database";
import { NotImplementedError } from "@/server/not-implemented";

/**
 * 予約の作成と操作(担当: S2 ゲスト予約)。
 * 関数の名前と引数は変えない。変えたいときは報告する(docs/plan.md の 3 章)。
 */

export type BookingResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; code: "not_found" | "slot_taken" | "invalid" | "forbidden" | "too_late"; message: string };

/** ゲストの予約。空き枠を計算し直し、排他制約で二重予約を防ぐ */
export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  void input;
  throw new NotImplementedError("createBooking", "S2");
}

/** ホストが承認する(承認制の予約ページ) */
export async function approveBooking(hostId: string, bookingId: string): Promise<BookingResult> {
  void hostId; void bookingId;
  throw new NotImplementedError("approveBooking", "S2");
}

/** ホストが辞退する */
export async function declineBooking(hostId: string, bookingId: string, reason?: string): Promise<BookingResult> {
  void hostId; void bookingId; void reason;
  throw new NotImplementedError("declineBooking", "S2");
}

/** キャンセル。by が guest のときは manage_token で本人を確かめる */
export async function cancelBooking(
  target: { by: "host"; hostId: string; bookingId: string } | { by: "guest"; token: string },
  reason?: string,
): Promise<BookingResult> {
  void target; void reason;
  throw new NotImplementedError("cancelBooking", "S2");
}

/** 日程変更(ゲストのみ)。新しい予約を作り、元の予約を取り消す */
export async function rescheduleBooking(token: string, startsAt: string): Promise<BookingResult> {
  void token; void startsAt;
  throw new NotImplementedError("rescheduleBooking", "S2");
}

export type { BookingAnswers };
