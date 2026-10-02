/**
 * 「カレンダーに追加」のリンク。完了画面とメールで使う。外部への通信をしない純粋な関数。
 */

export interface CalendarLinkEvent {
  title: string;
  start: Date | string;
  end: Date | string;
  details?: string;
  location?: string;
}

/** 20261005T010000Z の形(UTC) */
export function toIcsUtc(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Google カレンダーの予定作成画面を開く URL */
export function googleCalendarUrl(event: CalendarLinkEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${toIcsUtc(event.start)}/${toIcsUtc(event.end)}`,
  });
  if (event.details) params.set("details", event.details);
  if (event.location) params.set("location", event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
