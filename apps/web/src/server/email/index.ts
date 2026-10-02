import "server-only";
import { NotImplementedError } from "@/server/not-implemented";

/** 予約に関するメール(担当: S2 ゲスト予約)。RESEND_API_KEY が無いときはログに出すだけにする */

export type BookingEmailKind =
  | "booking_confirmed" // ゲストとホストへ: 確定
  | "booking_requested" // ゲストへ: 申請を受け付けた / ホストへ: 承認のお願い
  | "booking_declined"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_reminder";

export async function sendBookingEmail(kind: BookingEmailKind, bookingId: string): Promise<void> {
  void kind; void bookingId;
  throw new NotImplementedError("sendBookingEmail", "S2");
}
