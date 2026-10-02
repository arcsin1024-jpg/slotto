import { describe, expect, it } from "vitest";
import {
  computeTriggerTime,
  isStillDue,
  localDateKey,
  localDayRange,
  matchesTarget,
  nextDailyOccurrence,
  nextRetryAt,
  resolveRunAt,
  type DailyTrigger,
} from "./timing";

const at = (iso: string) => new Date(iso);
const event = { startsAt: at("2026-10-05T01:00:00Z"), endsAt: at("2026-10-05T02:00:00Z") };

describe("computeTriggerTime", () => {
  it("開始の N 分前", () => {
    expect(computeTriggerTime({ type: "before_start", offset_minutes: 10 }, event).toISOString()).toBe(
      "2026-10-05T00:50:00.000Z",
    );
  });
  it("開始時刻", () => {
    expect(computeTriggerTime({ type: "at_start" }, event).toISOString()).toBe("2026-10-05T01:00:00.000Z");
  });
  it("終了の N 分後(0 は終了時刻)", () => {
    expect(computeTriggerTime({ type: "after_end", offset_minutes: 0 }, event).toISOString()).toBe(
      "2026-10-05T02:00:00.000Z",
    );
    expect(computeTriggerTime({ type: "after_end", offset_minutes: 90 }, event).toISOString()).toBe(
      "2026-10-05T03:30:00.000Z",
    );
  });
});

describe("matchesTarget", () => {
  const booking = { type: "booking" as const, bookingPageId: "page-1" };
  const external = { type: "external_event" as const, bookingPageId: null };
  it("対象の種類で絞る", () => {
    expect(matchesTarget({ scope: "all" }, booking)).toBe(true);
    expect(matchesTarget({ scope: "all" }, external)).toBe(true);
    expect(matchesTarget({ scope: "bookings" }, external)).toBe(false);
    expect(matchesTarget({ scope: "selected_events" }, external)).toBe(true);
    expect(matchesTarget({ scope: "selected_events" }, booking)).toBe(false);
  });
  it("予約ページで絞る", () => {
    expect(matchesTarget({ scope: "booking_page", booking_page_id: "page-1" }, booking)).toBe(true);
    expect(matchesTarget({ scope: "booking_page", booking_page_id: "page-2" }, booking)).toBe(false);
    expect(matchesTarget({ scope: "booking_page", booking_page_id: "page-1" }, external)).toBe(false);
  });
});

describe("resolveRunAt", () => {
  const trigger = { type: "before_start", offset_minutes: 30 } as const;
  const scheduledFor = at("2026-10-05T00:30:00Z");

  it("未来ならその時刻", () => {
    expect(resolveRunAt(trigger, scheduledFor, event, at("2026-10-05T00:00:00Z"))).toEqual(scheduledFor);
  });
  it("過ぎて 5 分以内なら今", () => {
    const now = at("2026-10-05T00:34:00Z");
    expect(resolveRunAt({ type: "at_start" }, at("2026-10-05T00:30:00Z"), event, now)).toEqual(now);
  });
  it("「開始の前」は、開始前なら今すぐ動かす", () => {
    const now = at("2026-10-05T00:50:00Z");
    expect(resolveRunAt(trigger, scheduledFor, event, now)).toEqual(now);
  });
  it("開始を過ぎたら動かさない", () => {
    expect(resolveRunAt(trigger, scheduledFor, event, at("2026-10-05T01:01:00Z"))).toBeNull();
  });
  it("終了の後や開始時刻は、5 分を過ぎたら動かさない", () => {
    expect(resolveRunAt({ type: "at_start" }, event.startsAt, event, at("2026-10-05T01:06:00Z"))).toBeNull();
  });
  it("実行の直前の確認は 30 分まで待つ", () => {
    expect(isStillDue({ type: "at_start" }, event.startsAt, event, at("2026-10-05T01:29:00Z"))).toBe(true);
    expect(isStillDue({ type: "at_start" }, event.startsAt, event, at("2026-10-05T01:31:00Z"))).toBe(false);
  });
});

describe("nextDailyOccurrence", () => {
  const weekdays: DailyTrigger = { type: "daily", time: "08:00", weekdays: [1, 2, 3, 4, 5] };

  it("今日の時刻がまだなら今日(東京)", () => {
    // 2026-10-05 は月曜。東京の 07:00
    const result = nextDailyOccurrence(weekdays, "Asia/Tokyo", at("2026-10-04T22:00:00Z"));
    expect(result?.runAt.toISOString()).toBe("2026-10-04T23:00:00.000Z");
    expect(result?.localDate).toBe("2026-10-05");
  });
  it("今日の時刻を過ぎていれば翌日", () => {
    const result = nextDailyOccurrence(weekdays, "Asia/Tokyo", at("2026-10-04T23:00:00Z"));
    expect(result?.localDate).toBe("2026-10-06");
  });
  it("金曜の夜なら次の月曜(週末を飛ばす)", () => {
    // 2026-10-09 金曜 東京 20:00
    const result = nextDailyOccurrence(weekdays, "Asia/Tokyo", at("2026-10-09T11:00:00Z"));
    expect(result?.localDate).toBe("2026-10-12");
    expect(result?.runAt.toISOString()).toBe("2026-10-11T23:00:00.000Z");
  });
  it("曜日はホストのタイムゾーンで数える", () => {
    // UTC では日曜 23:30 だが、東京では月曜 08:30
    const result = nextDailyOccurrence({ type: "daily", time: "09:00", weekdays: [1] }, "Asia/Tokyo", at("2026-10-04T23:30:00Z"));
    expect(result?.localDate).toBe("2026-10-05");
    expect(result?.runAt.toISOString()).toBe("2026-10-05T00:00:00.000Z");
  });
  it("夏時間の切り替えでも現地の時刻に合わせる(ニューヨーク)", () => {
    // 2026-11-01 に夏時間が終わる。前後の日曜 08:00 はそれぞれ UTC 12:00 と 13:00
    const sunday: DailyTrigger = { type: "daily", time: "08:00", weekdays: [0] };
    expect(nextDailyOccurrence(sunday, "America/New_York", at("2026-10-24T00:00:00Z"))?.runAt.toISOString()).toBe(
      "2026-10-25T12:00:00.000Z",
    );
    expect(nextDailyOccurrence(sunday, "America/New_York", at("2026-10-31T00:00:00Z"))?.runAt.toISOString()).toBe(
      "2026-11-01T13:00:00.000Z",
    );
  });
});

describe("localDateKey / localDayRange", () => {
  it("タイムゾーンの日付と、その日の範囲", () => {
    const date = at("2026-10-04T16:00:00Z"); // 東京では 10-05 01:00
    expect(localDateKey(date, "Asia/Tokyo")).toBe("2026-10-05");
    const range = localDayRange(date, "Asia/Tokyo");
    expect(range.start.toISOString()).toBe("2026-10-04T15:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-10-05T15:00:00.000Z");
  });
});

describe("nextRetryAt", () => {
  const now = at("2026-10-05T00:00:00Z");
  const noJitter = () => 0.5;
  it("1 分、4 分、16 分と広げる", () => {
    expect(nextRetryAt(1, now, noJitter).getTime() - now.getTime()).toBe(60_000);
    expect(nextRetryAt(2, now, noJitter).getTime() - now.getTime()).toBe(240_000);
    expect(nextRetryAt(3, now, noJitter).getTime() - now.getTime()).toBe(960_000);
  });
  it("6 時間で頭打ち", () => {
    expect(nextRetryAt(20, now, noJitter).getTime() - now.getTime()).toBe(6 * 3600_000);
  });
  it("ゆらぎは ±20%", () => {
    expect(nextRetryAt(1, now, () => 0).getTime() - now.getTime()).toBe(48_000);
    expect(nextRetryAt(1, now, () => 1).getTime() - now.getTime()).toBe(72_000);
  });
});
