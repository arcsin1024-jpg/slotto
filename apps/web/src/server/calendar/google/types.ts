/**
 * Google Calendar API v3 の型(Slotto が使う項目だけ)。
 * https://developers.google.com/workspace/calendar/api/v3/reference
 */

export interface GoogleCalendarListEntry {
  id: string;
  summary?: string;
  summaryOverride?: string;
  backgroundColor?: string;
  timeZone?: string;
  primary?: boolean;
  /** freeBusyReader / reader / writer / owner */
  accessRole: string;
  hidden?: boolean;
  deleted?: boolean;
}

export interface GoogleEventDateTime {
  /** 終日の予定。"2026-10-05" */
  date?: string;
  /** 時刻のある予定。オフセット付きの RFC 3339 */
  dateTime?: string;
  timeZone?: string;
}

export interface GoogleEvent {
  id: string;
  /** confirmed / tentative / cancelled */
  status?: string;
  summary?: string;
  location?: string;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  /** opaque(予定あり、既定)/ transparent(予定なし) */
  transparency?: string;
  recurringEventId?: string;
  originalStartTime?: GoogleEventDateTime;
  htmlLink?: string;
  updated?: string;
  iCalUID?: string;
  eventType?: string;
  attendees?: { email?: string; self?: boolean; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string>; shared?: Record<string, string> };
  hangoutLink?: string;
  conferenceData?: {
    createRequest?: { requestId?: string; status?: { statusCode?: string } };
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
}

/** 予定の書き込みに使う本文 */
export interface GoogleEventInput {
  id?: string;
  summary?: string;
  description?: string;
  location?: string | null;
  start?: GoogleEventDateTime;
  end?: GoogleEventDateTime;
  attendees?: { email: string; displayName?: string }[];
  extendedProperties?: { private?: Record<string, string> };
  conferenceData?: {
    createRequest: { requestId: string; conferenceSolutionKey: { type: "hangoutsMeet" } };
  } | null;
}

export interface GoogleWatchChannel {
  id: string;
  resourceId: string;
  /** ミリ秒の文字列 */
  expiration?: string;
}
