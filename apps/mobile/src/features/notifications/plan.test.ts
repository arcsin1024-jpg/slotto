import { describe, expect, it } from "vitest";
import {
  diffSchedule,
  IDENTIFIER_PREFIX,
  type PlanDefaults,
  type PlanEvent,
  planNotifications,
} from "./plan";

const now = new Date("2026-10-05T00:00:00Z"); // 日本時間 9:00
const timeZone = "Asia/Tokyo";
const defaults: PlanDefaults = { notifyMinutes: [10], alarmMinutes: [], notifySelectedEvents: true };

function booking(id: string, startsAt: string, overrides: Partial<PlanEvent> = {}): PlanEvent {
  const start = new Date(startsAt);
  return {
    sourceType: "booking",
    id,
    title: `予約 ${id}`,
    startsAt: start.toISOString(),
    endsAt: new Date(start.getTime() + 30 * 60_000).toISOString(),
    isAllDay: false,
    status: "confirmed",
    meetingUrl: null,
    ...overrides,
  };
}

function external(id: string, startsAt: string, overrides: Partial<PlanEvent> = {}): PlanEvent {
  return { ...booking(id, startsAt), sourceType: "external_event", status: null, title: `外部 ${id}`, ...overrides };
}

describe("planNotifications", () => {
  it("初期値の分数で、開始の前に通知を予約する", () => {
    const planned = planNotifications({
      events: [booking("a", "2026-10-05T05:00:00Z")],
      defaults,
      overrides: [],
      now,
      timeZone,
    });
    expect(planned).toHaveLength(1);
    expect(planned[0]?.fireAt.toISOString()).toBe("2026-10-05T04:50:00.000Z");
    expect(planned[0]?.kind).toBe("notify");
    expect(planned[0]?.body).toBe("10 分後に始まります(14:00〜14:30)");
    expect(planned[0]?.identifier).toBe(`${IDENTIFIER_PREFIX}booking:a:notify:10`);
    expect(planned[0]?.data).toMatchObject({ type: "booking", id: "a" });
  });

  it("承認待ち・終日・過ぎた時刻は予約しない", () => {
    const planned = planNotifications({
      events: [
        booking("pending", "2026-10-05T05:00:00Z", { status: "pending" }),
        booking("allday", "2026-10-05T05:00:00Z", { isAllDay: true }),
        booking("soon", "2026-10-05T00:05:00Z"), // 10 分前はもう過ぎている
      ],
      defaults,
      overrides: [],
      now,
      timeZone,
    });
    expect(planned).toEqual([]);
  });

  it("外部予定は「反映中の外部予定も知らせる」がオフなら予約しない。ただし個別設定があれば従う", () => {
    const events = [external("x", "2026-10-05T05:00:00Z"), external("y", "2026-10-05T06:00:00Z")];
    const planned = planNotifications({
      events,
      defaults: { ...defaults, notifySelectedEvents: false },
      overrides: [{ sourceType: "external_event", sourceId: "y", notifyMinutes: [5], alarmMinutes: [], isMuted: false }],
      now,
      timeZone,
    });
    expect(planned.map((p) => p.identifier)).toEqual([`${IDENTIFIER_PREFIX}external_event:y:notify:5`]);
  });

  it("個別設定で鳴らさないにした予定は予約しない", () => {
    const planned = planNotifications({
      events: [booking("a", "2026-10-05T05:00:00Z")],
      defaults,
      overrides: [{ sourceType: "booking", sourceId: "a", notifyMinutes: [10], alarmMinutes: [0], isMuted: true }],
      now,
      timeZone,
    });
    expect(planned).toEqual([]);
  });

  it("通知とアラームが同じ分数なら、アラームだけにする。開始時刻のアラームは「今から」", () => {
    const planned = planNotifications({
      events: [booking("a", "2026-10-05T05:00:00Z", { meetingUrl: "https://meet.example/abc" })],
      defaults: { notifyMinutes: [0, 10], alarmMinutes: [0], notifySelectedEvents: true },
      overrides: [],
      now,
      timeZone,
    });
    expect(planned.map((p) => [p.kind, p.minutesBefore])).toEqual([
      ["notify", 10],
      ["alarm", 0],
    ]);
    expect(planned[1]?.title).toBe("まもなく開始: 予約 a");
    expect(planned[1]?.body).toBe("今から始まります(14:00〜14:30)");
    expect(planned[1]?.data.url).toBe("https://meet.example/abc");
  });

  it("近い順に上限の件数だけ予約する", () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      booking(`e${i}`, new Date(now.getTime() + (10 - i) * 3_600_000).toISOString()),
    );
    const planned = planNotifications({ events, defaults, overrides: [], now, timeZone, limit: 3 });
    expect(planned.map((p) => p.data.id)).toEqual(["e9", "e8", "e7"]);
  });
});

describe("diffSchedule", () => {
  const planned = planNotifications({
    events: [booking("a", "2026-10-05T05:00:00Z"), booking("b", "2026-10-05T06:00:00Z")],
    defaults,
    overrides: [],
    now,
    timeZone,
  });

  it("同じ内容のものは残し、無くなったもの・変わったものを取り消す。Slotto 以外の通知には触らない", () => {
    const [a, b] = planned;
    if (!a || !b) throw new Error("前提が違う");
    const result = diffSchedule(
      [
        { identifier: a.identifier, signature: a.data.signature },
        { identifier: b.identifier, signature: "古い内容" },
        { identifier: `${IDENTIFIER_PREFIX}booking:gone:notify:10`, signature: "x" },
        { identifier: "other-app-notification", signature: null },
      ],
      planned,
    );
    expect(result.cancel).toEqual([b.identifier, `${IDENTIFIER_PREFIX}booking:gone:notify:10`]);
    expect(result.schedule.map((p) => p.identifier)).toEqual([b.identifier]);
  });
});
