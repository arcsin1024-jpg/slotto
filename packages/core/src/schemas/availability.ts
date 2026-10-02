import { z } from "zod";

/** "09:00" の形。終了時刻に限り "24:00" を許す */
export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "時刻は 09:00 の形で入力してください");

const endTimeStringSchema = z
  .string()
  .regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "時刻は 18:00 の形で入力してください");

export const timeRangeSchema = z
  .object({ start: timeStringSchema, end: endTimeStringSchema })
  .refine((range) => range.start < range.end, "終了は開始より後にしてください");

const dayRangesSchema = z.array(timeRangeSchema).max(6).default([]);

/** 曜日のキー。0 が日曜、6 が土曜 */
export const WEEKDAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
export type WeekdayKey = (typeof WEEKDAY_KEYS)[number];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  "0": "日",
  "1": "月",
  "2": "火",
  "3": "水",
  "4": "木",
  "5": "金",
  "6": "土",
};

export const availabilityOverrideSchema = z.object({
  /** "2026-10-02" の形。予約ページのタイムゾーンでの日付 */
  date: z.iso.date(),
  /** 空の配列は「この日は受け付けない」 */
  ranges: z.array(timeRangeSchema).max(6),
});

/** 予約ページの受付時間。booking_pages.availability に入る */
export const availabilitySchema = z.object({
  weekly: z
    .object({
      "0": dayRangesSchema,
      "1": dayRangesSchema,
      "2": dayRangesSchema,
      "3": dayRangesSchema,
      "4": dayRangesSchema,
      "5": dayRangesSchema,
      "6": dayRangesSchema,
    })
    .default({ "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] }),
  overrides: z.array(availabilityOverrideSchema).max(200).default([]),
});

export type TimeRange = z.infer<typeof timeRangeSchema>;
export type AvailabilityOverride = z.infer<typeof availabilityOverrideSchema>;
export type Availability = z.infer<typeof availabilitySchema>;

/** 平日 10:00〜18:00 */
export const DEFAULT_AVAILABILITY: Availability = {
  weekly: {
    "0": [],
    "1": [{ start: "10:00", end: "18:00" }],
    "2": [{ start: "10:00", end: "18:00" }],
    "3": [{ start: "10:00", end: "18:00" }],
    "4": [{ start: "10:00", end: "18:00" }],
    "5": [{ start: "10:00", end: "18:00" }],
    "6": [],
  },
  overrides: [],
};
