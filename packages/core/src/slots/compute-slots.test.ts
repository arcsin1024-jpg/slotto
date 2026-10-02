import { describe, expect, it } from "vitest";
import { DEFAULT_AVAILABILITY } from "../schemas/availability";
import { computeSlots, groupSlotsByDate, isSlotAvailable, type SlotPageConfig } from "./compute-slots";

// 2026-10-05 は月曜。日本時間(UTC+9)で書く
const jst = (value: string) => new Date(`${value}+09:00`);
const interval = (start: string, end: string) => ({ start: jst(start), end: jst(end) });

const page: SlotPageConfig = {
  slot_mode: "availability",
  duration_minutes: 30,
  slot_interval_minutes: 30,
  buffer_before_minutes: 0,
  buffer_after_minutes: 0,
  min_notice_minutes: 0,
  max_days_ahead: 30,
  max_bookings_per_day: null,
  timezone: "Asia/Tokyo",
  availability: DEFAULT_AVAILABILITY,
  exclude_holidays: true,
};

const monday = {
  from: jst("2026-10-05T00:00:00"),
  to: jst("2026-10-06T00:00:00"),
  now: jst("2026-10-01T09:00:00"),
  bookings: [],
  externalBusy: [],
};

const startsOf = (slots: { start: string }[]) =>
  slots.map((slot) =>
    new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(slot.start)),
  );

describe("computeSlots", () => {
  it("受付時間の中で、刻みごとに枠を出す", () => {
    const slots = computeSlots({ page, ...monday });
    expect(slots).toHaveLength(16);
    expect(startsOf(slots)[0]).toBe("10:00");
    expect(startsOf(slots).at(-1)).toBe("17:30");
    expect(slots[0]).toEqual({
      start: jst("2026-10-05T10:00:00").toISOString(),
      end: jst("2026-10-05T10:30:00").toISOString(),
    });
  });

  it("所要時間が収まらない枠は出さない", () => {
    const slots = computeSlots({ page: { ...page, duration_minutes: 60 }, ...monday });
    expect(startsOf(slots).at(-1)).toBe("17:00");
  });

  it("受付時間のない曜日は枠を出さない", () => {
    const slots = computeSlots({
      page,
      ...monday,
      from: jst("2026-10-04T00:00:00"), // 日曜
      to: jst("2026-10-05T00:00:00"),
    });
    expect(slots).toEqual([]);
  });

  it("反映中の外部予定と重なる枠を除く", () => {
    const slots = computeSlots({
      page,
      ...monday,
      externalBusy: [interval("2026-10-05T11:00:00", "2026-10-05T12:00:00")],
    });
    const starts = startsOf(slots);
    expect(starts).not.toContain("11:00");
    expect(starts).not.toContain("11:30");
    expect(starts).toContain("10:30");
    expect(starts).toContain("12:00");
  });

  it("予約と重なる枠を除く", () => {
    const slots = computeSlots({
      page,
      ...monday,
      bookings: [interval("2026-10-05T10:00:00", "2026-10-05T10:30:00")],
    });
    expect(startsOf(slots)[0]).toBe("10:30");
  });

  it("前後の空き時間を確保する", () => {
    const slots = computeSlots({
      page: { ...page, buffer_before_minutes: 30, buffer_after_minutes: 30 },
      ...monday,
      bookings: [interval("2026-10-05T12:00:00", "2026-10-05T13:00:00")],
    });
    const starts = startsOf(slots);
    // 12:00 の予定の前 30 分と後 30 分にかかる枠は出ない
    expect(starts).toContain("11:00");
    expect(starts).not.toContain("11:30");
    expect(starts).not.toContain("13:00");
    expect(starts).toContain("13:30");
  });

  it("受付期限(何分前まで)より手前の枠を除く", () => {
    const slots = computeSlots({
      page: { ...page, min_notice_minutes: 180 },
      ...monday,
      now: jst("2026-10-05T09:15:00"),
    });
    // 09:15 の 3 時間後は 12:15。次の枠は 12:30
    expect(startsOf(slots)[0]).toBe("12:30");
  });

  it("受付期限(何日先まで)より先の枠を除く", () => {
    const input = {
      page: { ...page, max_days_ahead: 3 },
      ...monday,
      now: jst("2026-10-01T09:00:00"),
    };
    // 10/1 の 3 日先は 10/4。10/5 は受け付けない
    expect(computeSlots(input)).toEqual([]);
    expect(computeSlots({ ...input, page: { ...page, max_days_ahead: 4 } })).toHaveLength(16);
  });

  it("1 日の上限に達した日は枠を出さない", () => {
    const slots = computeSlots({
      page: { ...page, max_bookings_per_day: 2 },
      ...monday,
      bookings: [
        interval("2026-10-05T10:00:00", "2026-10-05T10:30:00"),
        interval("2026-10-05T15:00:00", "2026-10-05T15:30:00"),
      ],
    });
    expect(slots).toEqual([]);
  });

  it("祝日を除外する", () => {
    // 2026-10-12 はスポーツの日(月曜)
    const holiday = { from: jst("2026-10-12T00:00:00"), to: jst("2026-10-13T00:00:00") };
    expect(computeSlots({ page, ...monday, ...holiday })).toEqual([]);
    expect(computeSlots({ page: { ...page, exclude_holidays: false }, ...monday, ...holiday })).toHaveLength(16);
  });

  it("日付指定の例外を曜日の設定より優先する", () => {
    const availability = {
      ...DEFAULT_AVAILABILITY,
      overrides: [
        { date: "2026-10-05", ranges: [{ start: "13:00", end: "14:00" }] },
        { date: "2026-10-06", ranges: [] },
      ],
    };
    const slots = computeSlots({
      page: { ...page, availability },
      ...monday,
      to: jst("2026-10-07T00:00:00"),
    });
    expect(startsOf(slots)).toEqual(["13:00", "13:30"]);
  });

  it("終了時刻 24:00 を扱える", () => {
    const availability = {
      ...DEFAULT_AVAILABILITY,
      weekly: { ...DEFAULT_AVAILABILITY.weekly, "1": [{ start: "23:00", end: "24:00" }] },
    };
    const slots = computeSlots({ page: { ...page, availability }, ...monday });
    expect(startsOf(slots)).toEqual(["23:00", "23:30"]);
  });

  it("予約ページのタイムゾーンで受付時間を解釈する", () => {
    const slots = computeSlots({
      page: { ...page, timezone: "America/New_York", exclude_holidays: false },
      from: new Date("2026-10-05T00:00:00-04:00"),
      to: new Date("2026-10-06T00:00:00-04:00"),
      now: new Date("2026-10-01T00:00:00Z"),
      bookings: [],
      externalBusy: [],
    });
    expect(slots[0]?.start).toBe(new Date("2026-10-05T10:00:00-04:00").toISOString());
  });

  it("夏時間の切り替え日でも、現地の時刻で枠を出す", () => {
    // 2026-11-01 にニューヨークは夏時間が終わる(UTC-4 → UTC-5)。翌日の月曜は UTC-5
    const slots = computeSlots({
      page: { ...page, timezone: "America/New_York", exclude_holidays: false },
      from: new Date("2026-11-02T00:00:00-05:00"),
      to: new Date("2026-11-03T00:00:00-05:00"),
      now: new Date("2026-10-20T00:00:00Z"),
      bookings: [],
      externalBusy: [],
    });
    expect(slots[0]?.start).toBe(new Date("2026-11-02T10:00:00-05:00").toISOString());
  });

  it("候補を手で選ぶ予約ページでは、候補だけを枠にする", () => {
    const slots = computeSlots({
      page: { ...page, slot_mode: "candidates" },
      ...monday,
      candidates: [
        interval("2026-10-05T08:00:00", "2026-10-05T09:00:00"),
        interval("2026-10-05T20:00:00", "2026-10-05T21:00:00"),
      ],
      externalBusy: [interval("2026-10-05T20:30:00", "2026-10-05T21:30:00")],
    });
    // 受付時間の外でも候補は出る。外部予定と重なる候補は出ない
    expect(startsOf(slots)).toEqual(["08:00"]);
  });
});

describe("isSlotAvailable", () => {
  const input = { page, now: monday.now, bookings: [], externalBusy: [] };

  it("予約できる枠を返す", () => {
    expect(isSlotAvailable(input, jst("2026-10-05T10:00:00"))).toEqual({
      start: jst("2026-10-05T10:00:00").toISOString(),
      end: jst("2026-10-05T10:30:00").toISOString(),
    });
  });

  it("刻みに合わない時刻や埋まった枠は null を返す", () => {
    expect(isSlotAvailable(input, jst("2026-10-05T10:10:00"))).toBeNull();
    expect(
      isSlotAvailable(
        { ...input, bookings: [interval("2026-10-05T10:00:00", "2026-10-05T10:30:00")] },
        jst("2026-10-05T10:00:00"),
      ),
    ).toBeNull();
  });
});

describe("groupSlotsByDate", () => {
  it("見る人のタイムゾーンの日付でまとめる", () => {
    const slots = computeSlots({ page, ...monday });
    expect(Object.keys(groupSlotsByDate(slots, "Asia/Tokyo"))).toEqual(["2026-10-05"]);
    // 日本の 10:00〜17:30 は、ロサンゼルスでは前日の 18:00〜翌 01:30
    expect(Object.keys(groupSlotsByDate(slots, "America/Los_Angeles"))).toEqual(["2026-10-04", "2026-10-05"]);
  });
});
