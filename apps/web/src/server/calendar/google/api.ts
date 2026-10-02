import type {
  GoogleCalendarListEntry,
  GoogleEvent,
  GoogleEventInput,
  GoogleWatchChannel,
} from "./types";

/**
 * Google Calendar API のうち Slotto が使う操作。
 * 実物は createGoogleCalendarApi、単体テストでは偽物に差し替える。
 */
export interface GoogleCalendarApi {
  listCalendars(): Promise<GoogleCalendarListEntry[]>;
  /** 期間内の予定を、繰り返しを各回に展開して返す(削除済みは含まない) */
  listEvents(calendarId: string, range: { timeMin: Date; timeMax: Date }): Promise<GoogleEvent[]>;
  getEvent(calendarId: string, eventId: string): Promise<GoogleEvent>;
  insertEvent(calendarId: string, event: GoogleEventInput): Promise<GoogleEvent>;
  patchEvent(calendarId: string, eventId: string, event: GoogleEventInput): Promise<GoogleEvent>;
  /** 予定を消す。すでに無ければ何もしない */
  deleteEvent(calendarId: string, eventId: string): Promise<void>;
  watchEvents(
    calendarId: string,
    channel: { id: string; token: string; address: string; ttlSeconds?: number },
  ): Promise<GoogleWatchChannel>;
  stopChannel(channel: { id: string; resourceId: string }): Promise<void>;
}

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string | null,
    message: string,
  ) {
    super(message);
    this.name = "GoogleApiError";
  }
}

const BASE = "https://www.googleapis.com/calendar/v3";

/** 取り込む予定の種類。勤務場所や誕生日は空き時間に関係しないので外す */
const EVENT_TYPES = ["default", "focusTime", "outOfOffice"];

/** 取り込みに使う項目だけを返してもらう(説明文や参加者の詳細は受け取らない) */
const EVENT_FIELDS =
  "nextPageToken,items(id,status,summary,location,start,end,transparency,recurringEventId,originalStartTime," +
  "htmlLink,updated,iCalUID,eventType,attendees(self,responseStatus),extendedProperties/private)";

export interface GoogleApiOptions {
  /** アクセストークンを返す。force が true なら更新してから返す */
  getAccessToken: (force?: boolean) => Promise<string>;
  fetch?: typeof fetch;
  /** 再試行の待ち時間。テストでは 0 にする */
  sleep?: (ms: number) => Promise<void>;
}

export function createGoogleCalendarApi(options: GoogleApiOptions): GoogleCalendarApi {
  const doFetch = options.fetch ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  async function request<T>(
    method: string,
    path: string,
    init: { query?: URLSearchParams; body?: unknown; allowNotFound?: boolean } = {},
  ): Promise<T | null> {
    const url = `${BASE}${path}${init.query && [...init.query].length ? `?${init.query}` : ""}`;
    let refreshed = false;
    for (let attempt = 0; ; attempt++) {
      const token = await options.getAccessToken(refreshed);
      const response = await doFetch(url, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });

      if (response.ok) {
        if (response.status === 204) return null;
        const text = await response.text();
        return (text ? JSON.parse(text) : null) as T;
      }

      const { reason, message } = await readError(response);

      // アクセストークンの期限切れ。1 回だけ更新してやり直す
      if (response.status === 401 && !refreshed) {
        refreshed = true;
        continue;
      }
      if ((response.status === 404 || response.status === 410) && init.allowNotFound) return null;

      const retryable =
        response.status === 429 ||
        response.status >= 500 ||
        (response.status === 403 && (reason === "rateLimitExceeded" || reason === "userRateLimitExceeded"));
      if (retryable && attempt < 3) {
        await sleep(2 ** attempt * 1000 + Math.floor(Math.random() * 500));
        continue;
      }
      throw new GoogleApiError(response.status, reason, `Google Calendar API: ${response.status} ${message}`);
    }
  }

  const cal = (calendarId: string) => `/calendars/${encodeURIComponent(calendarId)}`;
  const writeQuery = () => new URLSearchParams({ conferenceDataVersion: "1", sendUpdates: "none" });

  return {
    async listCalendars() {
      const items: GoogleCalendarListEntry[] = [];
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({ minAccessRole: "reader", maxResults: "250" });
        if (pageToken) query.set("pageToken", pageToken);
        const page = await request<{ items?: GoogleCalendarListEntry[]; nextPageToken?: string }>(
          "GET",
          "/users/me/calendarList",
          { query },
        );
        items.push(...(page?.items ?? []));
        pageToken = page?.nextPageToken;
      } while (pageToken);
      return items.filter((c) => !c.deleted);
    },

    async listEvents(calendarId, range) {
      const items: GoogleEvent[] = [];
      let pageToken: string | undefined;
      do {
        const query = new URLSearchParams({
          singleEvents: "true",
          timeMin: range.timeMin.toISOString(),
          timeMax: range.timeMax.toISOString(),
          maxResults: "2500",
          fields: EVENT_FIELDS,
        });
        for (const type of EVENT_TYPES) query.append("eventTypes", type);
        if (pageToken) query.set("pageToken", pageToken);
        const page = await request<{ items?: GoogleEvent[]; nextPageToken?: string }>(
          "GET",
          `${cal(calendarId)}/events`,
          { query },
        );
        items.push(...(page?.items ?? []));
        pageToken = page?.nextPageToken;
      } while (pageToken);
      return items;
    },

    async getEvent(calendarId, eventId) {
      const event = await request<GoogleEvent>("GET", `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`);
      if (!event) throw new GoogleApiError(404, "notFound", "予定が見つかりません");
      return event;
    },

    async insertEvent(calendarId, event) {
      const created = await request<GoogleEvent>("POST", `${cal(calendarId)}/events`, {
        query: writeQuery(),
        body: event,
      });
      if (!created) throw new GoogleApiError(500, null, "予定の作成結果が空でした");
      return created;
    },

    async patchEvent(calendarId, eventId, event) {
      const patched = await request<GoogleEvent>(
        "PATCH",
        `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { query: writeQuery(), body: event },
      );
      if (!patched) throw new GoogleApiError(500, null, "予定の更新結果が空でした");
      return patched;
    },

    async deleteEvent(calendarId, eventId) {
      await request("DELETE", `${cal(calendarId)}/events/${encodeURIComponent(eventId)}`, {
        query: new URLSearchParams({ sendUpdates: "none" }),
        allowNotFound: true,
      });
    },

    async watchEvents(calendarId, channel) {
      const result = await request<GoogleWatchChannel>("POST", `${cal(calendarId)}/events/watch`, {
        body: {
          id: channel.id,
          type: "web_hook",
          address: channel.address,
          token: channel.token,
          ...(channel.ttlSeconds ? { params: { ttl: String(channel.ttlSeconds) } } : {}),
        },
      });
      if (!result) throw new GoogleApiError(500, null, "変更通知の登録結果が空でした");
      return result;
    },

    async stopChannel(channel) {
      await request("POST", "/channels/stop", { body: channel, allowNotFound: true });
    },
  };
}

async function readError(response: Response): Promise<{ reason: string | null; message: string }> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string; errors?: { reason?: string }[] };
    };
    return {
      reason: body.error?.errors?.[0]?.reason ?? null,
      message: body.error?.message ?? response.statusText,
    };
  } catch {
    return { reason: null, message: response.statusText };
  }
}
