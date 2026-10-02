import {
  availabilitySchema,
  formFieldsSchema,
  type Availability,
  type BookingAnswers,
  type FormField,
} from "@slotto/core";
import type { SlotPageConfig } from "@slotto/core/slots";
import type { BookingPageRow, BookingRow } from "@slotto/core/database";

/**
 * 予約の判定(外部への通信をしない純粋な関数)。単体テストあり。
 */

const MINUTE = 60_000;

const EMPTY_AVAILABILITY: Availability = {
  weekly: { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] },
  overrides: [],
};

/** DB の予約ページの行を、空き枠の計算の入力に直す。受付時間が壊れていれば受け付けない扱いにする */
export function toSlotPageConfig(page: BookingPageRow): SlotPageConfig {
  const parsed = availabilitySchema.safeParse(page.availability);
  return {
    slot_mode: page.slot_mode,
    duration_minutes: page.duration_minutes,
    slot_interval_minutes: page.slot_interval_minutes,
    buffer_before_minutes: page.buffer_before_minutes,
    buffer_after_minutes: page.buffer_after_minutes,
    min_notice_minutes: page.min_notice_minutes,
    max_days_ahead: page.max_days_ahead,
    max_bookings_per_day: page.max_bookings_per_day,
    timezone: page.timezone,
    availability: parsed.success ? parsed.data : EMPTY_AVAILABILITY,
    exclude_holidays: page.exclude_holidays,
  };
}

/** 予約ページの追加の質問。壊れていれば質問なしとして扱う */
export function parseFormFields(value: unknown): FormField[] {
  const parsed = formFieldsSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export type AnswersResult = { ok: true; answers: BookingAnswers } | { ok: false; message: string };

function isBlank(value: BookingAnswers[string] | undefined): boolean {
  if (value === undefined || value === false) return true;
  if (typeof value === "string") return value.trim() === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/**
 * 追加の質問への回答を、予約ページの質問に照らして確かめる。
 * 質問に無いキーは捨てる。必須の未回答、型の違い、選択肢に無い値は受け付けない。
 */
export function validateAnswers(fields: FormField[], answers: BookingAnswers): AnswersResult {
  const result: BookingAnswers = {};
  for (const field of fields) {
    const value = answers[field.id];
    if (isBlank(value)) {
      if (field.required) return { ok: false, message: `「${field.label}」を入力してください` };
      continue;
    }
    switch (field.type) {
      case "checkbox":
        if (typeof value !== "boolean") return { ok: false, message: `「${field.label}」の値が正しくありません` };
        result[field.id] = value;
        break;
      case "select":
      case "radio":
        if (typeof value !== "string" || !(field.options ?? []).includes(value)) {
          return { ok: false, message: `「${field.label}」は選択肢から選んでください` };
        }
        result[field.id] = value;
        break;
      case "phone":
        if (typeof value !== "string" || !/^[0-9+\-() ]{6,20}$/.test(value.trim())) {
          return { ok: false, message: `「${field.label}」は電話番号の形で入力してください` };
        }
        result[field.id] = value.trim();
        break;
      default:
        if (typeof value !== "string") return { ok: false, message: `「${field.label}」の値が正しくありません` };
        if (field.type === "text" && value.length > 200) {
          return { ok: false, message: `「${field.label}」は 200 文字以内で入力してください` };
        }
        result[field.id] = value.trim();
    }
  }
  return { ok: true, answers: result };
}

type ChangePage = Pick<
  BookingPageRow,
  "allow_guest_cancel" | "allow_guest_reschedule" | "guest_change_deadline_minutes" | "is_active" | "kind"
>;

export interface GuestChangeState {
  canCancel: boolean;
  canReschedule: boolean;
  /** 変更・キャンセルの期限。予約が有効でなければ null */
  deadline: Date | null;
  /** 期限を過ぎている */
  isPastDeadline: boolean;
}

/**
 * ゲストがキャンセル・日程変更できるか。
 * - 有効な予約(承認待ち・確定)だけ
 * - 期限は「開始の guest_change_deadline_minutes 分前」(0 なら開始時刻まで)
 * - 予約ページが消えていればキャンセルだけできる
 * - 日程変更は、予約ページが公開中のときだけ(1 回限りの予約ページは、予約で閉じていても変更できる)
 */
export function guestChangeState(
  booking: Pick<BookingRow, "status" | "starts_at">,
  page: ChangePage | null,
  now: Date,
): GuestChangeState {
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { canCancel: false, canReschedule: false, deadline: null, isPastDeadline: false };
  }
  const deadline = new Date(new Date(booking.starts_at).getTime() - (page?.guest_change_deadline_minutes ?? 0) * MINUTE);
  const isPastDeadline = now.getTime() >= deadline.getTime();
  if (isPastDeadline) return { canCancel: false, canReschedule: false, deadline, isPastDeadline };
  return {
    canCancel: page ? page.allow_guest_cancel : true,
    canReschedule: page !== null && page.allow_guest_reschedule && (page.is_active || page.kind === "one_time"),
    deadline,
    isPastDeadline,
  };
}

/** IANA のタイムゾーン名として使えるか */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}
