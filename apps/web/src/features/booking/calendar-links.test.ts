import { describe, expect, it } from "vitest";
import { googleCalendarUrl, toIcsUtc } from "./calendar-links";

describe("toIcsUtc", () => {
  it("UTC の基本形式にする", () => {
    expect(toIcsUtc("2026-10-05T01:00:00.000Z")).toBe("20261005T010000Z");
    expect(toIcsUtc(new Date("2026-10-05T10:00:00+09:00"))).toBe("20261005T010000Z");
  });
});

describe("googleCalendarUrl", () => {
  it("予定作成画面の URL に、タイトルと UTC の日時を入れる", () => {
    const url = new URL(
      googleCalendarUrl({
        title: "30 分のオンライン相談",
        start: "2026-10-05T01:00:00.000Z",
        end: "2026-10-05T01:30:00.000Z",
        location: "https://meet.google.com/abc",
      }),
    );
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/render");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("30 分のオンライン相談");
    expect(url.searchParams.get("dates")).toBe("20261005T010000Z/20261005T013000Z");
    expect(url.searchParams.get("location")).toBe("https://meet.google.com/abc");
    expect(url.searchParams.has("details")).toBe(false);
  });
});
