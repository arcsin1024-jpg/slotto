import { toIcsUtc } from "@/features/booking/calendar-links";

/**
 * 予約の招待(iCalendar、RFC 5545 / iMIP、RFC 6047)を作る。外部への通信をしない純粋な関数。
 *
 * - 同じ予約(日程変更でつながる一連の予約)では同じ UID を使い、送るたびに SEQUENCE を増やす
 * - 時刻は UTC(末尾 Z)で書き、VTIMEZONE を省く
 * - 行末は CRLF、1 行 75 オクテットで折り返す
 */

export type IcsMethod = "REQUEST" | "CANCEL";

export interface IcsPerson {
  name: string;
  email: string;
}

export interface IcsEvent {
  method: IcsMethod;
  uid: string;
  sequence: number;
  start: Date | string;
  end: Date | string;
  /** DTSTAMP。省略すると現在時刻 */
  stamp?: Date;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  organizer: IcsPerson;
  attendee: IcsPerson;
}

/** テキストの値のエスケープ(バックスラッシュ、セミコロン、カンマ、改行) */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** パラメータの値(CN など)。ダブルクォートは使えないので外し、全体をダブルクォートで囲む */
function paramValue(value: string): string {
  return `"${value.replace(/["\r\n]/g, "")}"`;
}

/** 1 行を 75 オクテットごとに折り返す。マルチバイト文字の途中では切らない */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  // 続きの行は先頭の空白 1 文字も 75 オクテットに数える
  let limit = 75;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (currentBytes + bytes > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += bytes;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

export function buildIcs(event: IcsEvent): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Slotto//Slotto//JA",
    "CALSCALE:GREGORIAN",
    `METHOD:${event.method}`,
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SEQUENCE:${event.sequence}`,
    `DTSTAMP:${toIcsUtc(event.stamp ?? new Date())}`,
    `DTSTART:${toIcsUtc(event.start)}`,
    `DTEND:${toIcsUtc(event.end)}`,
    `SUMMARY:${escapeText(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
  if (event.url) lines.push(`URL:${event.url}`);
  lines.push(
    `STATUS:${event.method === "CANCEL" ? "CANCELLED" : "CONFIRMED"}`,
    `ORGANIZER;CN=${paramValue(event.organizer.name)}:mailto:${event.organizer.email}`,
    // 出欠の返信は求めない
    `ATTENDEE;CN=${paramValue(event.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${event.attendee.email}`,
    "END:VEVENT",
    "END:VCALENDAR",
  );
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * 日程変更でつながる一連の予約の中での SEQUENCE。
 * 招待(REQUEST)は 2 × 世代、取り消し(CANCEL)は 2 × 世代 + 1 にして、常に前より大きくする。
 * 世代は、最初の予約が 0、日程変更するたびに 1 増える。
 */
export function icsSequence(method: IcsMethod, generation: number): number {
  return generation * 2 + (method === "CANCEL" ? 1 : 0);
}

/** UID は、一連の予約の最初の予約の ID から作る */
export function icsUid(rootBookingId: string): string {
  return `${rootBookingId}@slotto`;
}
