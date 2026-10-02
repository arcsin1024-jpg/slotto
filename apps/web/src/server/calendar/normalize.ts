import { TZDate } from "@date-fns/tz";
import type { GoogleEvent, GoogleEventDateTime } from "./google/types";

/** Slotto が書き込んだ予定に付ける目印(extendedProperties.private のキー) */
export const SLOTTO_BOOKING_PROPERTY = "slottoBookingId";

/** 取り込み用に整えた外部予定。external_events の内容の列に対応する */
export interface NormalizedEvent {
  providerEventId: string;
  seriesId: string | null;
  title: string;
  location: string | null;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  status: "confirmed" | "tentative";
  isBusy: boolean;
  htmlLink: string | null;
  providerUpdatedAt: string | null;
}

export interface NormalizeContext {
  /** 終日の予定を時刻に直すときのタイムゾーン(カレンダーのタイムゾーン) */
  timeZone: string;
  /** Slotto の予約として書き込んだ予定の ID(bookings.provider_event_id) */
  slottoEventIds: ReadonlySet<string>;
}

/**
 * Google の予定を取り込み用の形にする。取り込まない予定は null を返す。
 * - 削除された予定
 * - Slotto が書き込んだ予定(目印、または予約に保存した予定 ID で判定)
 * - 日時が読めない予定
 */
export function normalizeGoogleEvent(event: GoogleEvent, context: NormalizeContext): NormalizedEvent | null {
  if (event.status === "cancelled") return null;
  if (isSlottoEvent(event, context.slottoEventIds)) return null;

  const start = toInstant(event.start, context.timeZone);
  const end = toInstant(event.end, context.timeZone);
  if (!start || !end) return null;

  const isAllDay = Boolean(event.start?.date && !event.start.dateTime);
  const declined = event.attendees?.some((a) => a.self && a.responseStatus === "declined") ?? false;

  return {
    providerEventId: event.id,
    seriesId: event.recurringEventId ?? null,
    title: event.summary?.trim() || "(タイトルなし)",
    location: event.location?.trim() || null,
    startsAt: start,
    // 終了が開始より前になっている壊れた予定は、長さ 0 として扱う
    endsAt: end < start ? start : end,
    isAllDay,
    status: event.status === "tentative" ? "tentative" : "confirmed",
    // 「予定なし」にしている予定と、自分が辞退した予定はふさがっていない
    isBusy: event.transparency !== "transparent" && !declined,
    htmlLink: event.htmlLink ?? null,
    providerUpdatedAt: event.updated ? new Date(event.updated).toISOString() : null,
  };
}

export function isSlottoEvent(event: GoogleEvent, slottoEventIds: ReadonlySet<string>): boolean {
  return Boolean(event.extendedProperties?.private?.[SLOTTO_BOOKING_PROPERTY]) || slottoEventIds.has(event.id);
}

/** 予定の日時を UTC の ISO 文字列にする。終日の予定はカレンダーのタイムゾーンの 0 時にする */
function toInstant(value: GoogleEventDateTime | undefined, timeZone: string): string | null {
  if (value?.dateTime) {
    const date = new Date(value.dateTime);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  if (value?.date) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.date);
    if (!match) return null;
    const [, y, m, d] = match;
    return new Date(new TZDate(Number(y), Number(m) - 1, Number(d), timeZone).getTime()).toISOString();
  }
  return null;
}
