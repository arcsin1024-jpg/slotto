import type { Tables } from "@slotto/core/database";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { keys } from "./keys";
import { unwrap } from "./util";

export type Booking = Tables<"bookings">;
export type ExternalEvent = Tables<"external_events">;
export type ExternalCalendar = Tables<"external_calendars">;

/**
 * カレンダーやホームに並べる 1 件。予約と、反映中の外部予定を同じ形にしたもの。
 * 通知・アラームの予約(features/notifications)もこの形を使う。
 */
export interface AgendaItem {
  /** event_alarms.source_type と同じ値 */
  sourceType: "booking" | "external_event";
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  /** 予約の状態。外部予定は null */
  status: Booking["status"] | null;
  location: string | null;
  meetingUrl: string | null;
  /** 予約は相手の名前、外部予定はカレンダーの名前 */
  subtitle: string | null;
  /** 外部予定のカレンダーの色 */
  color: string | null;
}

export function bookingToAgendaItem(booking: Booking): AgendaItem {
  return {
    sourceType: "booking",
    id: booking.id,
    title: booking.title,
    startsAt: booking.starts_at,
    endsAt: booking.ends_at,
    isAllDay: false,
    status: booking.status,
    location: booking.location_value,
    meetingUrl: booking.meeting_url,
    subtitle: booking.guest_name,
    color: null,
  };
}

export function externalEventToAgendaItem(event: ExternalEvent, calendar?: ExternalCalendar): AgendaItem {
  return {
    sourceType: "external_event",
    id: event.id,
    title: event.title,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    isAllDay: event.is_all_day,
    status: null,
    location: event.location,
    meetingUrl: findMeetingUrl(event.location),
    subtitle: calendar?.name ?? null,
    color: calendar?.color ?? null,
  };
}

/** 場所の欄に書かれた会議 URL を拾う */
export function findMeetingUrl(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/https:\/\/[^\s]+/);
  return match ? match[0] : null;
}

/**
 * 期間内の、有効な予約(承認待ちと確定)と反映中の外部予定。開始時刻の順。
 * from を含み、to を含まない。
 */
export async function fetchAgenda(from: string, to: string): Promise<AgendaItem[]> {
  const [bookings, events, calendars] = await Promise.all([
    supabase
      .from("bookings")
      .select("*")
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", to)
      .gt("ends_at", from)
      .order("starts_at"),
    supabase
      .from("external_events")
      .select("*")
      .eq("is_selected", true)
      .lt("starts_at", to)
      .gt("ends_at", from)
      .order("starts_at"),
    supabase.from("external_calendars").select("*"),
  ]);
  const calendarById = new Map(unwrap(calendars).map((calendar) => [calendar.id, calendar]));
  const items = [
    ...unwrap(bookings).map(bookingToAgendaItem),
    ...unwrap(events).map((event) => externalEventToAgendaItem(event, calendarById.get(event.calendar_id))),
  ];
  return items.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function useAgenda(from: string, to: string) {
  return useQuery({
    queryKey: keys.agenda(from, to),
    queryFn: () => fetchAgenda(from, to),
  });
}

export function useExternalCalendars() {
  return useQuery({
    queryKey: keys.externalCalendars,
    queryFn: async () => unwrap(await supabase.from("external_calendars").select("*").order("name")),
  });
}
