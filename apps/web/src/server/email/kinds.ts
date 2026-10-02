/** 予約に関するメールの種類 */
export type BookingEmailKind =
  | "booking_confirmed" // ゲストとホストへ: 確定
  | "booking_requested" // ゲストへ: 申請を受け付けた / ホストへ: 承認のお願い
  | "booking_declined"
  | "booking_cancelled"
  | "booking_rescheduled"
  | "booking_reminder";
