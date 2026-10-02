import { TZDate } from "@date-fns/tz";
import type { AutomationTarget, AutomationTrigger } from "@slotto/core";

/**
 * ジョブの時刻の計算。外部への通信をしない純粋な関数だけを置く(単体テストの対象)。
 */

/** オートメーションの対象になる予定(予約、または反映中の外部予定) */
export interface ScheduleSource {
  type: "booking" | "external_event";
  id: string;
  /** 予約ページ(予約のときだけ) */
  bookingPageId: string | null;
  startsAt: Date;
  endsAt: Date;
  isAllDay: boolean;
}

export type TimedTrigger = Extract<AutomationTrigger, { type: "before_start" | "at_start" | "after_end" }>;
export type DailyTrigger = Extract<AutomationTrigger, { type: "daily" }>;

const MINUTE = 60_000;

/** 予定の時刻に合わせて動く(時刻型の)トリガーか */
export function isTimedTrigger(trigger: AutomationTrigger): trigger is TimedTrigger {
  return trigger.type === "before_start" || trigger.type === "at_start" || trigger.type === "after_end";
}

/** トリガーの本来の実行時刻 */
export function computeTriggerTime(trigger: TimedTrigger, source: Pick<ScheduleSource, "startsAt" | "endsAt">): Date {
  switch (trigger.type) {
    case "before_start":
      return new Date(source.startsAt.getTime() - trigger.offset_minutes * MINUTE);
    case "at_start":
      return new Date(source.startsAt.getTime());
    case "after_end":
      return new Date(source.endsAt.getTime() + trigger.offset_minutes * MINUTE);
  }
}

/** オートメーションの対象に、この予定が入るか */
export function matchesTarget(target: AutomationTarget, source: Pick<ScheduleSource, "type" | "bookingPageId">): boolean {
  switch (target.scope) {
    case "all":
      return true;
    case "bookings":
      return source.type === "booking";
    case "selected_events":
      return source.type === "external_event";
    case "booking_page":
      return source.type === "booking" && source.bookingPageId === target.booking_page_id;
  }
}

/** 登録の時点で時刻を過ぎていても、この時間内なら今すぐ動かす */
export const CATCH_UP_GRACE_MS = 5 * MINUTE;
/** 実行が遅れたとき、この時間を過ぎたら動かさない(dispatch が止まっていた場合など) */
export const LATE_LIMIT_MS = 30 * MINUTE;

/**
 * 本来の時刻が過ぎているかもしれないジョブの、実際の実行時刻を決める。動かさないなら null。
 * - 本来の時刻が未来ならその時刻
 * - 過ぎていても grace 以内なら今
 * - 「開始の N 分前」は、開始前であれば今(開始の 5 分前に予約が入った場合など)
 */
export function resolveRunAt(
  trigger: AutomationTrigger | { type: "reminder" },
  scheduledFor: Date,
  source: Pick<ScheduleSource, "startsAt"> | null,
  now: Date,
  graceMs: number = CATCH_UP_GRACE_MS,
): Date | null {
  if (scheduledFor.getTime() >= now.getTime()) return scheduledFor;
  if (now.getTime() - scheduledFor.getTime() <= graceMs) return now;
  if (trigger.type === "before_start" && source && now.getTime() < source.startsAt.getTime()) return now;
  return null;
}

/** 実行の直前に、まだ動かしてよいかを確かめる */
export function isStillDue(
  trigger: AutomationTrigger,
  scheduledFor: Date,
  source: Pick<ScheduleSource, "startsAt"> | null,
  now: Date,
): boolean {
  return resolveRunAt(trigger, scheduledFor, source, now, LATE_LIMIT_MS) !== null;
}

/** "08:30" → [8, 30] */
function parseTime(time: string): [number, number] {
  const [h, m] = time.split(":").map(Number);
  return [h ?? 0, m ?? 0];
}

/** 指定のタイムゾーンでの日付(YYYY-MM-DD) */
export function localDateKey(date: Date, timeZone: string): string {
  const d = new TZDate(date.getTime(), timeZone);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 指定のタイムゾーンでの、その日の 0 時と翌日の 0 時 */
export function localDayRange(date: Date, timeZone: string): { start: Date; end: Date } {
  const d = new TZDate(date.getTime(), timeZone);
  const start = new TZDate(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0, timeZone);
  const end = new TZDate(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0, timeZone);
  return { start: new Date(start.getTime()), end: new Date(end.getTime()) };
}

/**
 * 「毎日決まった時刻」の次の実行時刻(now より後)。曜日はホストのタイムゾーンで数える(0 が日曜)。
 * 返す localDate はその実行の日付(dedupe_key に使う)。
 */
export function nextDailyOccurrence(
  trigger: DailyTrigger,
  timeZone: string,
  now: Date,
): { runAt: Date; localDate: string } | null {
  const [hour, minute] = parseTime(trigger.time);
  const today = new TZDate(now.getTime(), timeZone);
  for (let i = 0; i <= 7; i++) {
    const candidate = new TZDate(today.getFullYear(), today.getMonth(), today.getDate() + i, hour, minute, 0, 0, timeZone);
    if (candidate.getTime() <= now.getTime()) continue;
    if (!trigger.weekdays.includes(candidate.getDay())) continue;
    const runAt = new Date(candidate.getTime());
    return { runAt, localDate: localDateKey(runAt, timeZone) };
  }
  return null;
}

/**
 * 失敗したジョブの次の試行時刻(指数バックオフ + ゆらぎ)。
 * attempts は、失敗した試行を含めたこれまでの試行回数(1 以上)。1 分、4 分、16 分…と広げ、6 時間で頭打ち。
 */
export function nextRetryAt(attempts: number, now: Date, random: () => number = Math.random): Date {
  const base = Math.min(MINUTE * 4 ** Math.max(0, attempts - 1), 6 * 60 * MINUTE);
  const jitter = 0.8 + random() * 0.4;
  return new Date(now.getTime() + Math.round(base * jitter));
}
