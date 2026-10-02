import { TZDate } from "@date-fns/tz";
import holidayJp from "@holiday-jp/holiday_jp";
import type { Availability, TimeRange, WeekdayKey } from "../schemas/availability";

const MINUTE = 60_000;
const DAY = 86_400_000;

/** 時間帯。start を含み、end を含まない */
export interface Interval {
  start: Date;
  end: Date;
}

/** 予約できる枠。ISO 8601(UTC)の文字列 */
export interface Slot {
  start: string;
  end: string;
}

/** 空き枠の計算に使う、予約ページの設定。キーは booking_pages の列名と同じ */
export interface SlotPageConfig {
  slot_mode: "availability" | "candidates";
  duration_minutes: number;
  slot_interval_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  max_bookings_per_day: number | null;
  timezone: string;
  availability: Availability;
  exclude_holidays: boolean;
}

export interface ComputeSlotsInput {
  page: SlotPageConfig;
  /** 対象期間。from を含み、to を含まない */
  from: Date;
  to: Date;
  now: Date;
  /** 有効な予約(承認待ちと確定)。1 日の上限の数え上げにも使う */
  bookings: Interval[];
  /** 反映中の外部予定。選んでいない外部予定は渡さない */
  externalBusy: Interval[];
  /** slot_mode が candidates のときの候補日時 */
  candidates?: Interval[];
}

/**
 * 予約できる枠を計算する。外部への通信をしない純粋な関数。
 *
 * 枠 [開始, 終了) は、前後の空き時間を足した範囲が、予約とも反映中の外部予定とも
 * 重ならないときに予約できる。
 */
export function computeSlots(input: ComputeSlotsInput): Slot[] {
  const { page, now } = input;
  const timeZone = page.timezone;

  // 受け付ける開始時刻の範囲
  const earliest = Math.max(input.from.getTime(), now.getTime() + page.min_notice_minutes * MINUTE);
  const today = localDateParts(now, timeZone);
  const lastDayEnd = zonedTime(today.year, today.month, today.day + page.max_days_ahead + 1, 0, 0, timeZone);
  const latest = Math.min(input.to.getTime(), lastDayEnd);
  if (earliest >= latest) return [];

  const busy = mergeIntervals([...input.bookings, ...input.externalBusy]);
  const bookingsPerDay = countByLocalDate(input.bookings, timeZone);
  const isDayFull = (dateKey: string) =>
    page.max_bookings_per_day !== null && (bookingsPerDay.get(dateKey) ?? 0) >= page.max_bookings_per_day;

  const before = page.buffer_before_minutes * MINUTE;
  const after = page.buffer_after_minutes * MINUTE;
  const isFree = (start: number, end: number) => !overlapsAny(busy, start - before, end + after);

  const found = new Map<number, number>();

  if (page.slot_mode === "candidates") {
    for (const candidate of input.candidates ?? []) {
      const start = candidate.start.getTime();
      const end = candidate.end.getTime();
      if (start < earliest || start >= latest) continue;
      if (isDayFull(localDateKey(candidate.start, timeZone))) continue;
      if (isFree(start, end)) found.set(start, end);
    }
    return toSlots(found);
  }

  const duration = page.duration_minutes * MINUTE;
  const step = Math.max(page.slot_interval_minutes, 5) * MINUTE;
  const overrides = new Map(page.availability.overrides.map((o) => [o.date, o.ranges]));

  // 対象期間にかかる日を、予約ページのタイムゾーンの日付で 1 日ずつ見る
  const first = localDateParts(new Date(earliest), timeZone);
  const last = localDateParts(new Date(latest - 1), timeZone);
  const lastDay = Date.UTC(last.year, last.month - 1, last.day);

  for (let day = Date.UTC(first.year, first.month - 1, first.day); day <= lastDay; day += DAY) {
    const date = new Date(day);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const dayOfMonth = date.getUTCDate();
    const dateKey = formatDateKey(year, month, dayOfMonth);

    const override = overrides.get(dateKey);
    // 日付指定の例外があれば、祝日でもその設定を優先する
    if (!override && page.exclude_holidays && holidayJp.isHoliday(dateKey)) continue;
    if (isDayFull(dateKey)) continue;

    const weekday = String(date.getUTCDay()) as WeekdayKey;
    const ranges: TimeRange[] = override ?? page.availability.weekly[weekday] ?? [];

    for (const range of ranges) {
      const rangeStart = zonedTime(year, month, dayOfMonth, ...parseTime(range.start), timeZone);
      const rangeEnd = zonedTime(year, month, dayOfMonth, ...parseTime(range.end), timeZone);
      for (let start = rangeStart; start + duration <= rangeEnd; start += step) {
        if (start < earliest || start >= latest) continue;
        if (isFree(start, start + duration)) found.set(start, start + duration);
      }
    }
  }

  return toSlots(found);
}

/** 指定した開始時刻の枠が予約できるかを確かめる。予約を確定する直前の再確認に使う */
export function isSlotAvailable(
  input: Omit<ComputeSlotsInput, "from" | "to">,
  startsAt: Date,
): Slot | null {
  const from = new Date(startsAt.getTime() - DAY);
  const to = new Date(startsAt.getTime() + DAY);
  const iso = startsAt.toISOString();
  return computeSlots({ ...input, from, to }).find((slot) => slot.start === iso) ?? null;
}

/** 枠を、見る人のタイムゾーンの日付("2026-10-02")ごとにまとめる */
export function groupSlotsByDate(slots: Slot[], timeZone: string): Record<string, Slot[]> {
  const groups: Record<string, Slot[]> = {};
  for (const slot of slots) {
    const key = localDateKey(new Date(slot.start), timeZone);
    (groups[key] ??= []).push(slot);
  }
  return groups;
}

/** その時刻の、タイムゾーンでの日付("2026-10-02") */
export function localDateKey(date: Date, timeZone: string): string {
  const { year, month, day } = localDateParts(date, timeZone);
  return formatDateKey(year, month, day);
}

function localDateParts(date: Date, timeZone: string) {
  const zoned = new TZDate(date.getTime(), timeZone);
  return { year: zoned.getFullYear(), month: zoned.getMonth() + 1, day: zoned.getDate() };
}

/** タイムゾーンでの年月日・時分を、実際の時刻(ミリ秒)に直す。日や時の繰り上がりも受け付ける */
function zonedTime(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number,
  timeZone: string,
): number {
  return new TZDate(year, month - 1, day, hours, minutes, timeZone).getTime();
}

function parseTime(time: string): [number, number] {
  const [hours = "0", minutes = "0"] = time.split(":");
  return [Number(hours), Number(minutes)];
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

interface Range {
  start: number;
  end: number;
}

/** 重なる時間帯をまとめ、開始時刻の順に並べる */
function mergeIntervals(intervals: Interval[]): Range[] {
  const sorted = intervals
    .map((i) => ({ start: i.start.getTime(), end: i.end.getTime() }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  const merged: Range[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function overlapsAny(busy: Range[], start: number, end: number): boolean {
  // busy は開始時刻の順で、互いに重ならない。start より後に終わる最初の時間帯を探す
  let low = 0;
  let high = busy.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (busy[mid]!.end <= start) low = mid + 1;
    else high = mid;
  }
  const candidate = busy[low];
  return candidate !== undefined && candidate.start < end;
}

function countByLocalDate(intervals: Interval[], timeZone: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const interval of intervals) {
    const key = localDateKey(interval.start, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function toSlots(found: Map<number, number>): Slot[] {
  return [...found.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([start, end]) => ({
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    }));
}
