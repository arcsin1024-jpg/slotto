import "server-only";
import type { BookingRow } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { GoogleApiError, type GoogleCalendarApi } from "./google/api";
import { googleApiForConnection } from "./google/client";
import { buildBookingEventInput, bookingEventId, meetingUrlOf } from "./booking-event-input";

/**
 * 予約を外部カレンダーに書き込む。
 * - 書き込み先: 予約ページの write_calendar_id(無ければ書かない)
 * - 予定 ID は予約 ID から作る。再送しても同じ予定になり、二重に作られない
 * - Slotto の目印(extendedProperties.private)を付け、取り込みの対象から外す
 * - 場所が Google Meet なら会議 URL を発行する
 * 書き込んだ予定の ID とカレンダーは bookings に保存する(更新・削除で使う)。
 */

type Admin = ReturnType<typeof createAdminClient>;

interface Target {
  api: GoogleCalendarApi;
  calendarRowId: string;
  providerCalendarId: string;
}

export async function writeBookingEvent(
  bookingId: string,
): Promise<{ providerEventId: string; meetingUrl: string | null } | null> {
  const admin = createAdminClient();
  const booking = await loadBooking(admin, bookingId);
  if (booking.provider_event_id && booking.provider_calendar_id) {
    // すでに書き込み済み。内容を合わせて返す
    return patchExisting(admin, booking);
  }

  const target = await resolvePageTarget(admin, booking);
  if (!target) return null;

  const input = buildBookingEventInput(booking, { id: bookingEventId(booking.id), withMeet: booking.location_type === "google_meet" });
  let event;
  try {
    event = await target.api.insertEvent(target.providerCalendarId, input);
  } catch (e) {
    // 前回の書き込みが届いていて、同じ ID の予定がすでにある
    if (e instanceof GoogleApiError && e.status === 409) {
      event = await target.api.patchEvent(target.providerCalendarId, input.id!, { ...input, id: undefined });
    } else {
      throw e;
    }
  }
  event = await waitForMeet(target.api, target.providerCalendarId, event);
  const meetingUrl = meetingUrlOf(event);

  await saveWritten(admin, booking.id, {
    provider_event_id: event.id,
    provider_calendar_id: target.calendarRowId,
    ...(meetingUrl ? { meeting_url: meetingUrl } : {}),
  });
  return { providerEventId: event.id, meetingUrl };
}

/**
 * 予約の変更を外部カレンダーに反映する。
 * - キャンセル・辞退になっていれば予定を消す
 * - 書き込み済みなら時刻やタイトルを合わせる(会議 URL はそのまま)
 * - 日程変更で新しい予約が作られた場合(rescheduled_from)は、元の予約の予定を新しい時刻に動かして引き継ぐ
 * - まだ書き込んでいなければ書き込む
 */
export async function updateBookingEvent(bookingId: string): Promise<void> {
  const admin = createAdminClient();
  const booking = await loadBooking(admin, bookingId);

  if (booking.status === "cancelled" || booking.status === "declined") {
    await deleteBookingEvent(bookingId);
    return;
  }
  if (booking.provider_event_id && booking.provider_calendar_id) {
    await patchExisting(admin, booking);
    return;
  }
  if (booking.rescheduled_from) {
    const previous = await loadBooking(admin, booking.rescheduled_from).catch(() => null);
    if (previous?.provider_event_id && previous.provider_calendar_id) {
      await moveFromPrevious(admin, booking, previous);
      return;
    }
  }
  await writeBookingEvent(bookingId);
}

/** 書き込んだ予定を消す。書き込んでいなければ何もしない */
export async function deleteBookingEvent(bookingId: string): Promise<void> {
  const admin = createAdminClient();
  const booking = await loadBooking(admin, bookingId);
  if (!booking.provider_event_id || !booking.provider_calendar_id) return;

  const target = await resolveCalendarTarget(admin, booking.provider_calendar_id);
  if (target) await target.api.deleteEvent(target.providerCalendarId, booking.provider_event_id);
  await saveWritten(admin, booking.id, { provider_event_id: null, provider_calendar_id: null });
}

// ---------------------------------------------------------------------------

async function patchExisting(admin: Admin, booking: BookingRow) {
  const target = await resolveCalendarTarget(admin, booking.provider_calendar_id!);
  if (!target) return null;
  const input = buildBookingEventInput(booking, { withMeet: false });
  const event = await target.api.patchEvent(target.providerCalendarId, booking.provider_event_id!, input);
  const meetingUrl = meetingUrlOf(event) ?? booking.meeting_url;
  if (meetingUrl !== booking.meeting_url) await saveWritten(admin, booking.id, { meeting_url: meetingUrl });
  return { providerEventId: event.id, meetingUrl };
}

async function moveFromPrevious(admin: Admin, booking: BookingRow, previous: BookingRow) {
  const target = await resolveCalendarTarget(admin, previous.provider_calendar_id!);
  if (!target) {
    await writeBookingEvent(booking.id);
    return;
  }
  const event = await target.api.patchEvent(
    target.providerCalendarId,
    previous.provider_event_id!,
    buildBookingEventInput(booking, { withMeet: false }),
  );
  const meetingUrl = meetingUrlOf(event) ?? previous.meeting_url;
  // 予定は新しい予約のものにする。元の予約からは外す(元の予約のキャンセルで消されないように)
  await saveWritten(admin, previous.id, { provider_event_id: null, provider_calendar_id: null });
  await saveWritten(admin, booking.id, {
    provider_event_id: event.id,
    provider_calendar_id: previous.provider_calendar_id,
    ...(meetingUrl ? { meeting_url: meetingUrl } : {}),
  });
}

/** Meet の会議は非同期で作られる。準備中なら少し待って取り直す */
async function waitForMeet(api: GoogleCalendarApi, calendarId: string, event: Awaited<ReturnType<GoogleCalendarApi["insertEvent"]>>) {
  let current = event;
  for (let i = 0; i < 3; i++) {
    if (current.conferenceData?.createRequest?.status?.statusCode !== "pending") break;
    await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
    current = await api.getEvent(calendarId, current.id);
  }
  return current;
}

async function loadBooking(admin: Admin, bookingId: string): Promise<BookingRow> {
  const { data, error } = await admin.from("bookings").select("*").eq("id", bookingId).maybeSingle();
  if (error) throw new Error(`予約の読み込みに失敗しました: ${error.message}`);
  if (!data) throw new Error(`予約が見つかりません: ${bookingId}`);
  return data;
}

async function resolvePageTarget(admin: Admin, booking: BookingRow): Promise<Target | null> {
  if (!booking.booking_page_id) return null;
  const { data: page } = await admin
    .from("booking_pages")
    .select("write_calendar_id")
    .eq("id", booking.booking_page_id)
    .maybeSingle();
  if (!page?.write_calendar_id) return null;
  return resolveCalendarTarget(admin, page.write_calendar_id);
}

/** 書き込み先のカレンダーと、その接続の API。使えない状態なら null */
async function resolveCalendarTarget(admin: Admin, calendarRowId: string): Promise<Target | null> {
  const { data: calendar } = await admin
    .from("external_calendars")
    .select("id, connection_id, provider_calendar_id, can_write")
    .eq("id", calendarRowId)
    .maybeSingle();
  if (!calendar?.can_write) return null;
  const { data: connection } = await admin
    .from("calendar_connections")
    .select("provider, status")
    .eq("id", calendar.connection_id)
    .maybeSingle();
  if (connection?.provider !== "google" || connection.status !== "active") return null;
  return {
    api: googleApiForConnection(calendar.connection_id),
    calendarRowId: calendar.id,
    providerCalendarId: calendar.provider_calendar_id,
  };
}

async function saveWritten(
  admin: Admin,
  bookingId: string,
  values: { provider_event_id?: string | null; provider_calendar_id?: string | null; meeting_url?: string | null },
) {
  const { error } = await admin.from("bookings").update(values).eq("id", bookingId);
  if (error) throw new Error(`予約の更新に失敗しました: ${error.message}`);
}
