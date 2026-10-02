import { describe, expect, it } from "vitest";
import type { GoogleCalendarApi } from "./google/api";
import type { GoogleEvent } from "./google/types";
import { normalizeGoogleEvent, SLOTTO_BOOKING_PROPERTY } from "./normalize";
import {
  syncCalendarEvents,
  syncWindow,
  type EventInsert,
  type EventUpdate,
  type StoredEvent,
  type SyncStore,
} from "./sync-core";

// ---------------------------------------------------------------------------
// 偽物の Google API と DB
// ---------------------------------------------------------------------------

class FakeGoogle {
  events: GoogleEvent[] = [];
  readonly api: GoogleCalendarApi = {
    listCalendars: async () => [],
    listEvents: async (_calendarId, range) =>
      // 実物と同じく、期間にかかる予定だけを返す
      this.events
        .filter((e) => e.status !== "cancelled")
        .filter((e) => {
          const start = Date.parse(e.start?.dateTime ?? `${e.start?.date}T00:00:00+09:00`);
          const end = Date.parse(e.end?.dateTime ?? `${e.end?.date}T00:00:00+09:00`);
          return end > range.timeMin.getTime() && start < range.timeMax.getTime();
        })
        .map((e) => structuredClone(e)),
    getEvent: async () => {
      throw new Error("not used");
    },
    insertEvent: async () => {
      throw new Error("not used");
    },
    patchEvent: async () => {
      throw new Error("not used");
    },
    deleteEvent: async () => {},
    watchEvents: async () => {
      throw new Error("not used");
    },
    stopChannel: async () => {},
  };
}

class MemoryStore implements SyncStore {
  rows = new Map<string, StoredEvent & { calendarId: string; selectedBy: string | null }>();
  series = new Set<string>();
  private nextId = 1;

  async listEvents(calendarId: string) {
    return [...this.rows.values()].filter((r) => r.calendarId === calendarId).map((r) => ({ ...r }));
  }
  async listSeriesSelections() {
    return new Set(this.series);
  }
  async insertEvents(calendarId: string, events: EventInsert[]) {
    for (const e of events) {
      if ([...this.rows.values()].some((r) => r.calendarId === calendarId && r.providerEventId === e.providerEventId)) {
        throw new Error(`一意制約: ${e.providerEventId}`);
      }
      const id = `row-${this.nextId++}`;
      this.rows.set(id, { ...e, id, calendarId, selectedBy: e.selectedBy });
    }
  }
  async updateEvents(_calendarId: string, events: EventUpdate[]) {
    for (const e of events) {
      const row = this.rows.get(e.id);
      if (!row) throw new Error(`行がありません: ${e.id}`);
      this.rows.set(e.id, { ...row, ...e, isSelected: row.isSelected, selectedBy: row.selectedBy });
    }
  }
  async deleteEvents(ids: string[]) {
    for (const id of ids) this.rows.delete(id);
  }

  byProviderId(providerEventId: string) {
    return [...this.rows.values()].find((r) => r.providerEventId === providerEventId);
  }
}

// 2026-10-05(月)9:00 JST を「今」とする
const NOW = new Date("2026-10-05T00:00:00Z");
const TZ = "Asia/Tokyo";
const WINDOW = syncWindow(NOW, TZ, 90);

function timed(id: string, start: string, end: string, extra: Partial<GoogleEvent> = {}): GoogleEvent {
  return {
    id,
    status: "confirmed",
    summary: id,
    start: { dateTime: `${start}+09:00` },
    end: { dateTime: `${end}+09:00` },
    updated: "2026-10-01T00:00:00Z",
    ...extra,
  };
}

/** 毎週の繰り返しを各回に展開した形(singleEvents=true の結果と同じ形) */
function weekly(seriesId: string, firstDay: string, count: number, time = ["10:00", "11:00"]): GoogleEvent[] {
  const first = new Date(`${firstDay}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(first.getTime() + i * 7 * 86_400_000).toISOString().slice(0, 10);
    return timed(`${seriesId}_${day.replaceAll("-", "")}`, `${day}T${time[0]}:00`, `${day}T${time[1]}:00`, {
      summary: "週次定例",
      recurringEventId: seriesId,
      originalStartTime: { dateTime: `${day}T${time[0]}:00+09:00` },
    });
  });
}

function setup(options: { autoSelectNew?: boolean; slottoEventIds?: string[] } = {}) {
  const google = new FakeGoogle();
  const store = new MemoryStore();
  const run = () =>
    syncCalendarEvents({
      api: google.api,
      store,
      calendar: { id: "cal-1", providerCalendarId: "primary", autoSelectNew: options.autoSelectNew ?? false, timeZone: TZ },
      slottoEventIds: new Set(options.slottoEventIds ?? []),
      window: WINDOW,
    });
  return { google, store, run };
}

// ---------------------------------------------------------------------------

describe("syncCalendarEvents", () => {
  it("新しい予定は未選択で入る", async () => {
    const { google, store, run } = setup();
    google.events = [timed("a", "2026-10-06T10:00", "2026-10-06T11:00"), timed("b", "2026-10-07T13:00", "2026-10-07T14:00")];

    expect(await run()).toEqual({ added: 2, updated: 0, removed: 0 });
    expect(store.byProviderId("a")).toMatchObject({
      title: "a",
      startsAt: "2026-10-06T01:00:00.000Z",
      endsAt: "2026-10-06T02:00:00.000Z",
      isSelected: false,
      selectedBy: null,
    });
  });

  it("変わっていなければ何も書き込まない", async () => {
    const { google, run } = setup();
    google.events = [timed("a", "2026-10-06T10:00", "2026-10-06T11:00", { location: "会議室 A" })];
    await run();
    expect(await run()).toEqual({ added: 0, updated: 0, removed: 0 });
  });

  it("変更は内容だけ更新し、選択の状態は保つ", async () => {
    const { google, store, run } = setup();
    google.events = [timed("a", "2026-10-06T10:00", "2026-10-06T11:00")];
    await run();
    store.byProviderId("a")!.isSelected = true;

    google.events = [timed("a", "2026-10-06T15:00", "2026-10-06T16:30", { summary: "時間変更", location: "オンライン" })];
    expect(await run()).toEqual({ added: 0, updated: 1, removed: 0 });
    expect(store.byProviderId("a")).toMatchObject({
      title: "時間変更",
      location: "オンライン",
      startsAt: "2026-10-06T06:00:00.000Z",
      endsAt: "2026-10-06T07:30:00.000Z",
      isSelected: true,
    });
  });

  it("外部で消えた予定は消す。期間より前の予定は残す", async () => {
    const { google, store, run } = setup();
    google.events = [timed("a", "2026-10-06T10:00", "2026-10-06T11:00"), timed("b", "2026-10-07T10:00", "2026-10-07T11:00")];
    await run();
    // 前日の予定(今日より前。今回の読み込み期間の外)
    await store.insertEvents("cal-1", [
      {
        ...normalizeGoogleEvent(timed("past", "2026-10-04T10:00", "2026-10-04T11:00"), { timeZone: TZ, slottoEventIds: new Set() })!,
        isSelected: true,
        selectedBy: null,
      },
    ]);

    google.events = [timed("a", "2026-10-06T10:00", "2026-10-06T11:00")];
    expect(await run()).toEqual({ added: 0, updated: 0, removed: 1 });
    expect(store.byProviderId("b")).toBeUndefined();
    expect(store.byProviderId("past")).toBeDefined();
  });

  it("期間の外へ動かされた予定は消し、期間の外から入ってきた予定は更新する", async () => {
    const { google, store, run } = setup();
    google.events = [timed("moved-out", "2026-10-06T10:00", "2026-10-06T11:00")];
    await run();
    await store.insertEvents("cal-1", [
      {
        ...normalizeGoogleEvent(timed("moved-in", "2026-10-04T10:00", "2026-10-04T11:00"), { timeZone: TZ, slottoEventIds: new Set() })!,
        isSelected: true,
        selectedBy: null,
      },
    ]);

    google.events = [
      timed("moved-out", "2027-03-01T10:00", "2027-03-01T11:00"),
      timed("moved-in", "2026-10-08T10:00", "2026-10-08T11:00"),
    ];
    expect(await run()).toEqual({ added: 0, updated: 1, removed: 1 });
    expect(store.byProviderId("moved-out")).toBeUndefined();
    expect(store.byProviderId("moved-in")).toMatchObject({ startsAt: "2026-10-08T01:00:00.000Z", isSelected: true });
  });

  it("繰り返し予定は各回を 1 行にし、series_id に親の ID を入れる", async () => {
    const { google, store, run } = setup();
    google.events = weekly("series-1", "2026-10-06", 4);

    expect(await run()).toEqual({ added: 4, updated: 0, removed: 0 });
    const rows = await store.listEvents("cal-1");
    expect(rows.map((r) => r.seriesId)).toEqual(["series-1", "series-1", "series-1", "series-1"]);
    expect(rows.every((r) => !r.isSelected)).toBe(true);
  });

  it("繰り返しの 1 回だけが外部で消されたら、その回だけ消す", async () => {
    const { google, store, run } = setup();
    google.events = weekly("series-1", "2026-10-06", 4);
    await run();

    google.events[1]!.status = "cancelled";
    expect(await run()).toEqual({ added: 0, updated: 0, removed: 1 });
    expect(store.byProviderId("series-1_20261013")).toBeUndefined();
    expect((await store.listEvents("cal-1")).length).toBe(3);
  });

  it("「今後すべて」に指定した繰り返しの新しい回は、選択済みで入る", async () => {
    const { google, store, run } = setup();
    store.series.add("series-1");
    google.events = [...weekly("series-1", "2026-10-06", 2), timed("single", "2026-10-06T15:00", "2026-10-06T16:00")];

    await run();
    expect(store.byProviderId("series-1_20261006")).toMatchObject({ isSelected: true, selectedBy: "series" });
    expect(store.byProviderId("series-1_20261013")).toMatchObject({ isSelected: true, selectedBy: "series" });
    expect(store.byProviderId("single")).toMatchObject({ isSelected: false, selectedBy: null });

    // あとから増えた回も選択済みで入る
    google.events = weekly("series-1", "2026-10-06", 3);
    await run();
    expect(store.byProviderId("series-1_20261020")).toMatchObject({ isSelected: true, selectedBy: "series" });
  });

  it("自動で反映がオンなら、新しい「予定あり」の予定は選択済みで入る", async () => {
    const { google, store, run } = setup({ autoSelectNew: true });
    google.events = [
      timed("busy", "2026-10-06T10:00", "2026-10-06T11:00"),
      timed("free", "2026-10-06T12:00", "2026-10-06T13:00", { transparency: "transparent" }),
    ];

    await run();
    expect(store.byProviderId("busy")).toMatchObject({ isSelected: true, selectedBy: "auto", isBusy: true });
    expect(store.byProviderId("free")).toMatchObject({ isSelected: false, selectedBy: null, isBusy: false });
  });

  it("自動で反映は新しい予定だけに効き、選択を外した既存の予定は選び直さない", async () => {
    const { google, store, run } = setup({ autoSelectNew: true });
    google.events = [timed("a", "2026-10-06T10:00", "2026-10-06T11:00")];
    await run();
    store.byProviderId("a")!.isSelected = false;

    google.events = [timed("a", "2026-10-06T10:30", "2026-10-06T11:00")];
    await run();
    expect(store.byProviderId("a")).toMatchObject({ isSelected: false, startsAt: "2026-10-06T01:30:00.000Z" });
  });

  it("Slotto が書き込んだ予定は取り込まない(目印、または予約に保存した予定 ID)", async () => {
    const { google, store, run } = setup({ slottoEventIds: ["written-before"] });
    google.events = [
      timed("marked", "2026-10-06T10:00", "2026-10-06T11:00", {
        extendedProperties: { private: { [SLOTTO_BOOKING_PROPERTY]: "booking-1" } },
      }),
      timed("written-before", "2026-10-06T12:00", "2026-10-06T13:00"),
      timed("normal", "2026-10-06T14:00", "2026-10-06T15:00"),
    ];

    expect(await run()).toEqual({ added: 1, updated: 0, removed: 0 });
    expect(store.byProviderId("normal")).toBeDefined();
  });

  it("終日の予定はカレンダーのタイムゾーンの 0 時から翌日の 0 時までにする", async () => {
    const { google, store, run } = setup();
    google.events = [
      { id: "allday", status: "confirmed", summary: "休暇", start: { date: "2026-10-09" }, end: { date: "2026-10-10" } },
    ];
    await run();
    expect(store.byProviderId("allday")).toMatchObject({
      isAllDay: true,
      startsAt: "2026-10-08T15:00:00.000Z",
      endsAt: "2026-10-09T15:00:00.000Z",
    });
  });
});

describe("normalizeGoogleEvent", () => {
  const context = { timeZone: TZ, slottoEventIds: new Set<string>() };

  it("自分が辞退した予定は「予定あり」にしない", () => {
    const event = timed("x", "2026-10-06T10:00", "2026-10-06T11:00", {
      attendees: [{ self: true, responseStatus: "declined" }],
    });
    expect(normalizeGoogleEvent(event, context)?.isBusy).toBe(false);
  });

  it("仮の予定は tentative、タイトルが無ければ代わりの文言を入れる", () => {
    const event = timed("x", "2026-10-06T10:00", "2026-10-06T11:00", { status: "tentative", summary: "  " });
    expect(normalizeGoogleEvent(event, context)).toMatchObject({ status: "tentative", title: "(タイトルなし)" });
  });

  it("削除された予定と日時の無い予定は null", () => {
    expect(normalizeGoogleEvent({ id: "x", status: "cancelled" }, context)).toBeNull();
    expect(normalizeGoogleEvent({ id: "y", status: "confirmed" }, context)).toBeNull();
  });
});

describe("syncWindow", () => {
  it("タイムゾーンでの今日の 0 時から N 日先まで", () => {
    // 2026-10-05 23:30 JST
    const window = syncWindow(new Date("2026-10-05T14:30:00Z"), TZ, 90);
    expect(window.timeMin.toISOString()).toBe("2026-10-04T15:00:00.000Z");
    expect(window.timeMax.toISOString()).toBe("2027-01-02T15:00:00.000Z");
  });

  it("夏時間のあるタイムゾーンでも日付の境目に合わせる", () => {
    const window = syncWindow(new Date("2026-10-30T12:00:00Z"), "America/New_York", 7);
    // 10/30 は夏時間(UTC-4)、11/6 は冬時間(UTC-5)
    expect(window.timeMin.toISOString()).toBe("2026-10-30T04:00:00.000Z");
    expect(window.timeMax.toISOString()).toBe("2026-11-06T05:00:00.000Z");
  });
});
