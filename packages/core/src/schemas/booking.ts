import { z } from "zod";

/** 追加の質問への回答。キーはフォーム項目の id */
export const bookingAnswersSchema = z.record(
  z.string(),
  z.union([z.string().max(2000), z.boolean(), z.array(z.string().max(200)).max(20)]),
);

export type BookingAnswers = z.infer<typeof bookingAnswersSchema>;

/** ゲストが予約を作るときの入力(POST /api/public/bookings) */
export const createBookingInputSchema = z.object({
  username: z.string().min(1),
  slug: z.string().min(1),
  /** 選んだ枠の開始時刻(ISO 8601) */
  starts_at: z.iso.datetime({ offset: true }),
  guest_name: z.string().trim().min(1, "お名前を入力してください").max(100),
  guest_email: z.email("メールアドレスの形式が正しくありません").max(254),
  guest_timezone: z.string().min(1).default("Asia/Tokyo"),
  answers: bookingAnswersSchema.default({}),
});

export type CreateBookingInput = z.infer<typeof createBookingInputSchema>;

/** ゲストによるキャンセル(POST /api/public/bookings/{token}/cancel) */
export const cancelBookingInputSchema = z.object({
  reason: z.string().max(500).optional(),
});

/** ゲストによる日程変更(POST /api/public/bookings/{token}/reschedule) */
export const rescheduleBookingInputSchema = z.object({
  starts_at: z.iso.datetime({ offset: true }),
});

export type CancelBookingInput = z.infer<typeof cancelBookingInputSchema>;
export type RescheduleBookingInput = z.infer<typeof rescheduleBookingInputSchema>;

/** 外部予定の選択・解除(POST /api/external-events/selection) */
export const eventSelectionInputSchema = z.object({
  event_ids: z.array(z.uuid()).min(1).max(500),
  selected: z.boolean(),
  /** true のとき、同じ繰り返しの今後の予定すべてに適用する */
  apply_to_series: z.boolean().default(false),
});

export type EventSelectionInput = z.infer<typeof eventSelectionInputSchema>;
