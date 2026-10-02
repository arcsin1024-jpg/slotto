import "server-only";
import { formatDateTimeRange } from "@slotto/core";
import type { BookingPageRow, BookingRow } from "@slotto/core/database";
import { deleteBookingEvent, writeBookingEvent } from "@/server/calendar";
import { sendBookingEmail } from "@/server/email";
import { cancelBookingJobs, scheduleBookingJobs, triggerBookingAutomations } from "@/server/jobs";
import { sendPush } from "@/server/push";
import type { AdminClient } from "./data";
import { recordEvent, safely } from "./events";

/**
 * 予約の後処理。どれが失敗しても予約自体は失敗させない(events.ts の safely)。
 * 外部への通信を伴うので、DB のトランザクション(create_booking)の外で行う。
 */

async function hostTimeZone(db: AdminClient, hostId: string, fallback: string): Promise<string> {
  const { data } = await db.from("profiles").select("timezone").eq("id", hostId).maybeSingle();
  return data?.timezone ?? fallback;
}

async function pushToHost(db: AdminClient, booking: BookingRow, title: string) {
  const timeZone = await hostTimeZone(db, booking.host_id, booking.guest_timezone);
  await sendPush(booking.host_id, {
    title,
    body: `${booking.guest_name} さん・${formatDateTimeRange(booking.starts_at, booking.ends_at, timeZone)}`,
    data: { type: "booking", id: booking.id },
  });
}

/** 外部カレンダーに書き込み、会議 URL を予約に保存する。書き込んだあとの予約を返す */
async function writeCalendar(db: AdminClient, booking: BookingRow, page: BookingPageRow | null): Promise<BookingRow> {
  const written = await safely(db, booking.id, "calendar.write", () => writeBookingEvent(booking.id));
  if (!written) return booking;
  const { data, error } = await db
    .from("bookings")
    .update({
      provider_event_id: written.providerEventId,
      provider_calendar_id: page?.write_calendar_id ?? booking.provider_calendar_id,
      meeting_url: written.meetingUrl ?? booking.meeting_url,
    })
    .eq("id", booking.id)
    .select("*")
    .single();
  if (error) {
    console.error(`[booking] 会議 URL を保存できませんでした(予約 ${booking.id})`, error);
    return { ...booking, provider_event_id: written.providerEventId, meeting_url: written.meetingUrl ?? booking.meeting_url };
  }
  await recordEvent(db, booking.id, "calendar_written", "system", {
    provider_event_id: written.providerEventId,
    has_meeting_url: written.meetingUrl !== null,
  });
  return data;
}

/**
 * 予約が確定したとき(即時確定の予約、承認、確定した予約への日程変更)。
 * カレンダーへの書き込み → メール → ジョブ → オートメーション → ホストへの通知 の順。
 */
export async function afterConfirmed(
  db: AdminClient,
  booking: BookingRow,
  page: BookingPageRow | null,
  reason: "created" | "approved" | "rescheduled",
  previous?: BookingRow | null,
): Promise<BookingRow> {
  if (previous) {
    if (previous.provider_event_id) {
      await safely(db, previous.id, "calendar.delete", () => deleteBookingEvent(previous.id));
    }
    await safely(db, previous.id, "jobs.cancel", () => cancelBookingJobs(previous.id));
  }

  const updated = await writeCalendar(db, booking, page);

  await safely(db, booking.id, "email", () =>
    reason === "rescheduled"
      ? sendBookingEmail("booking_rescheduled", booking.id)
      : sendBookingEmail("booking_confirmed", booking.id, { recipients: reason === "approved" ? ["guest"] : ["guest", "host"] }),
  );
  await safely(db, booking.id, "jobs.schedule", () => scheduleBookingJobs(booking.id));
  // 日程変更は「予約が入ったとき」のオートメーションを動かさない(同じ予約の時間が変わっただけのため)
  if (reason !== "rescheduled") {
    await safely(db, booking.id, "automations", () => triggerBookingAutomations("booking_created", booking.id));
  }
  if (reason !== "approved") {
    await safely(db, booking.id, "push", () =>
      pushToHost(db, updated, reason === "rescheduled" ? "予約の日時が変更されました" : "新しい予約が入りました"),
    );
  }
  return updated;
}

/** 承認制の予約ページで、承認待ちの予約ができたとき(新しい予約、または日程変更) */
export async function afterRequested(db: AdminClient, booking: BookingRow, previous?: BookingRow | null): Promise<void> {
  if (previous) {
    if (previous.provider_event_id) {
      await safely(db, previous.id, "calendar.delete", () => deleteBookingEvent(previous.id));
    }
    await safely(db, previous.id, "jobs.cancel", () => cancelBookingJobs(previous.id));
  }
  await safely(db, booking.id, "email", () =>
    sendBookingEmail(previous ? "booking_rescheduled" : "booking_requested", booking.id),
  );
  await safely(db, booking.id, "push", () =>
    pushToHost(db, booking, previous ? "日時の変更の申請があります" : "承認待ちの予約があります"),
  );
}

/** キャンセル・辞退のあと */
export async function afterCancelled(
  db: AdminClient,
  booking: BookingRow,
  action: "cancelled" | "declined",
  previousStatus: BookingRow["status"],
): Promise<void> {
  if (booking.provider_event_id) {
    await safely(db, booking.id, "calendar.delete", () => deleteBookingEvent(booking.id));
  }
  await safely(db, booking.id, "jobs.cancel", () => cancelBookingJobs(booking.id));

  if (action === "declined") {
    await safely(db, booking.id, "email", () => sendBookingEmail("booking_declined", booking.id));
    return;
  }

  const byGuest = booking.cancelled_by === "guest";
  await safely(db, booking.id, "email", () =>
    sendBookingEmail("booking_cancelled", booking.id, {
      // ホストが自分で取り消したときは、ホストには送らない
      recipients: byGuest ? ["guest", "host"] : ["guest"],
      previousStatus,
    }),
  );
  // 「予約が入ったとき」と対にして、確定していた予約のときだけ動かす
  if (previousStatus === "confirmed") {
    await safely(db, booking.id, "automations", () => triggerBookingAutomations("booking_cancelled", booking.id));
  }
  if (byGuest) {
    await safely(db, booking.id, "push", () => pushToHost(db, booking, "予約がキャンセルされました"));
  }
}
