import { z } from "zod";
import { LOCATION_TYPES, PAGE_COLORS, SLUG_PATTERN } from "../constants";
import { availabilitySchema, DEFAULT_AVAILABILITY } from "./availability";

export const FORM_FIELD_TYPES = ["text", "textarea", "select", "radio", "checkbox", "phone"] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "1 行の入力",
  textarea: "複数行の入力",
  select: "プルダウン",
  radio: "1 つ選ぶ",
  checkbox: "チェック",
  phone: "電話番号",
};

/** 予約フォームの追加の質問。名前とメールは固定で、ここには含めない */
export const formFieldSchema = z
  .object({
    id: z.string().min(1).max(40),
    type: z.enum(FORM_FIELD_TYPES),
    label: z.string().trim().min(1, "質問文を入力してください").max(100),
    required: z.boolean().default(false),
    placeholder: z.string().max(100).optional(),
    /** select と radio の選択肢 */
    options: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  })
  .refine(
    (field) =>
      (field.type !== "select" && field.type !== "radio") || (field.options?.length ?? 0) >= 2,
    { message: "選択肢を 2 つ以上入力してください", path: ["options"] },
  );

export const formFieldsSchema = z.array(formFieldSchema).max(15);

export type FormField = z.infer<typeof formFieldSchema>;

/**
 * 予約ページの作成・更新の入力。キーは booking_pages の列名と同じ。
 * 更新のときは `bookingPageInputSchema.partial()` を使う。
 */
export const bookingPageInputSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_PATTERN, "URL は半角の英小文字・数字・ハイフンで入力してください"),
  description: z.string().max(2000).nullable().default(null),
  color: z.enum(PAGE_COLORS).default("blue"),
  kind: z.enum(["recurring", "one_time"]).default("recurring"),
  slot_mode: z.enum(["availability", "candidates"]).default("availability"),
  duration_minutes: z.number().int().min(5).max(720).default(30),
  slot_interval_minutes: z.number().int().min(5).max(720).default(30),
  buffer_before_minutes: z.number().int().min(0).max(240).default(0),
  buffer_after_minutes: z.number().int().min(0).max(240).default(0),
  min_notice_minutes: z.number().int().min(0).max(43200).default(180),
  max_days_ahead: z.number().int().min(1).max(365).default(30),
  max_bookings_per_day: z.number().int().min(1).max(50).nullable().default(null),
  timezone: z.string().min(1).default("Asia/Tokyo"),
  availability: availabilitySchema.default(DEFAULT_AVAILABILITY),
  exclude_holidays: z.boolean().default(true),
  location_type: z.enum(LOCATION_TYPES).default("google_meet"),
  location_value: z.string().max(500).nullable().default(null),
  confirmation_mode: z.enum(["instant", "approval"]).default("instant"),
  form_fields: formFieldsSchema.default([]),
  reminder_minutes: z.array(z.number().int().min(5).max(20160)).max(3).default([1440]),
  allow_guest_cancel: z.boolean().default(true),
  allow_guest_reschedule: z.boolean().default(true),
  guest_change_deadline_minutes: z.number().int().min(0).max(43200).default(0),
  write_calendar_id: z.uuid().nullable().default(null),
  completion_message: z.string().max(1000).nullable().default(null),
  is_active: z.boolean().default(true),
});

export type BookingPageInput = z.infer<typeof bookingPageInputSchema>;

/** ホストが手で選ぶ候補日時(slot_mode が candidates のとき) */
export const candidateSlotSchema = z
  .object({ starts_at: z.iso.datetime({ offset: true }), ends_at: z.iso.datetime({ offset: true }) })
  .refine((slot) => slot.starts_at < slot.ends_at, "終了は開始より後にしてください");

export type CandidateSlot = z.infer<typeof candidateSlotSchema>;
