import { describe, expect, it, vi } from "vitest";
import { bookingEventId, buildBookingEventInput, meetingUrlOf } from "./booking-event-input";
import { createGoogleCalendarApi, GoogleApiError } from "./google/api";
import { buildAuthorizationUrl, hasRequiredScopes, REQUIRED_CALENDAR_SCOPES } from "./google/oauth";
import { SLOTTO_BOOKING_PROPERTY } from "./normalize";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("createGoogleCalendarApi", () => {
  it("予定の一覧はページをたどってすべて読み、繰り返しを展開する指定で呼ぶ", async () => {
    const calls: string[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      calls.push(String(url));
      return String(url).includes("pageToken=p2")
        ? jsonResponse(200, { items: [{ id: "b" }] })
        : jsonResponse(200, { items: [{ id: "a" }], nextPageToken: "p2" });
    });
    const api = createGoogleCalendarApi({ getAccessToken: async () => "t", fetch: fetchMock as typeof fetch });

    const events = await api.listEvents("primary", {
      timeMin: new Date("2026-10-05T00:00:00Z"),
      timeMax: new Date("2027-01-03T00:00:00Z"),
    });
    expect(events.map((e) => e.id)).toEqual(["a", "b"]);
    const first = new URL(calls[0]!);
    expect(first.pathname).toBe("/calendar/v3/calendars/primary/events");
    expect(first.searchParams.get("singleEvents")).toBe("true");
    expect(first.searchParams.get("timeMin")).toBe("2026-10-05T00:00:00.000Z");
    expect(first.searchParams.getAll("eventTypes")).toEqual(["default", "focusTime", "outOfOffice"]);
  });

  it("401 ならトークンを更新して 1 回だけやり直す", async () => {
    const tokens: boolean[] = [];
    let n = 0;
    const fetchMock = vi.fn(async () => (n++ === 0 ? jsonResponse(401, { error: { message: "expired" } }) : jsonResponse(200, { items: [] })));
    const api = createGoogleCalendarApi({
      getAccessToken: async (force) => {
        tokens.push(Boolean(force));
        return force ? "new" : "old";
      },
      fetch: fetchMock as typeof fetch,
    });
    await api.listCalendars();
    expect(tokens).toEqual([false, true]);
  });

  it("消す予定がすでに無くてもエラーにしない。それ以外の失敗は GoogleApiError", async () => {
    const api = createGoogleCalendarApi({
      getAccessToken: async () => "t",
      fetch: (async () => jsonResponse(410, { error: { message: "deleted" } })) as typeof fetch,
    });
    await expect(api.deleteEvent("primary", "x")).resolves.toBeUndefined();

    const failing = createGoogleCalendarApi({
      getAccessToken: async () => "t",
      fetch: (async () => jsonResponse(403, { error: { message: "forbidden", errors: [{ reason: "forbidden" }] } })) as typeof fetch,
    });
    await expect(failing.getEvent("primary", "x")).rejects.toBeInstanceOf(GoogleApiError);
  });

  it("回数制限は待ってからやり直す", async () => {
    let n = 0;
    const api = createGoogleCalendarApi({
      getAccessToken: async () => "t",
      fetch: (async () => (n++ < 2 ? jsonResponse(429, {}) : jsonResponse(200, { items: [] }))) as typeof fetch,
      sleep: async () => {},
    });
    await expect(api.listCalendars()).resolves.toEqual([]);
    expect(n).toBe(3);
  });
});

describe("OAuth", () => {
  it("同意画面の URL に、オフラインのアクセス・毎回の同意・PKCE を付ける", () => {
    const url = new URL(
      buildAuthorizationUrl(
        { clientId: "id", clientSecret: "secret", redirectUri: "https://slotto.example/api/calendar/google/callback" },
        { state: "s", codeChallenge: "c" },
      ),
    );
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("calendar.events");
    expect(url.searchParams.has("client_secret")).toBe(false);
  });

  it("カレンダーのスコープが外されていたら連携を完了しない", () => {
    expect(hasRequiredScopes(["openid", "email", ...REQUIRED_CALENDAR_SCOPES])).toBe(true);
    expect(hasRequiredScopes(["openid", "email", REQUIRED_CALENDAR_SCOPES[0]!])).toBe(false);
  });
});

describe("予約の書き込み内容", () => {
  const booking = {
    id: "3f2c8a1e-0b4d-4c55-9e1a-7d2b6c9f0a11",
    title: "30 分のオンライン相談",
    starts_at: "2026-10-06T01:00:00+00:00",
    ends_at: "2026-10-06T01:30:00+00:00",
    guest_name: "佐藤 太郎",
    guest_email: "taro@example.com",
    location_type: "google_meet",
    location_value: null,
  };

  it("予定 ID は Google が受け付ける文字だけで作る", () => {
    expect(bookingEventId(booking.id)).toMatch(/^[a-v0-9]{5,1024}$/);
  });

  it("Slotto の目印を付け、Meet は予約 ID から作った requestId で発行する", () => {
    const input = buildBookingEventInput(booking, { id: bookingEventId(booking.id), withMeet: true });
    expect(input.extendedProperties?.private?.[SLOTTO_BOOKING_PROPERTY]).toBe(booking.id);
    expect(input.conferenceData?.createRequest.requestId).toBe(`slotto-${booking.id}`);
    expect(input.start?.dateTime).toBe("2026-10-06T01:00:00.000Z");
    expect(input.location).toBeNull();
  });

  it("対面などは場所を入れ、会議は作らない", () => {
    const input = buildBookingEventInput({ ...booking, location_type: "in_person", location_value: "渋谷オフィス" }, { withMeet: false });
    expect(input.location).toBe("渋谷オフィス");
    expect(input.conferenceData).toBeUndefined();
  });

  it("会議 URL は hangoutLink か、映像の入口から取り出す", () => {
    expect(meetingUrlOf({ id: "x", hangoutLink: "https://meet.google.com/abc" })).toBe("https://meet.google.com/abc");
    expect(
      meetingUrlOf({ id: "x", conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/def" }] } }),
    ).toBe("https://meet.google.com/def");
    expect(meetingUrlOf({ id: "x" })).toBeNull();
  });
});
