import "server-only";
import type { BookingRow } from "@slotto/core/database";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { findBookingById, findHostEmail, findPageById, findRescheduleRoot, type AdminClient } from "@/server/booking/data";
import { recordEvent } from "@/server/booking/events";
import { parseFormFields } from "@/server/booking/rules";
import { buildIcs, icsSequence, icsUid, type IcsMethod } from "./ics";
import type { BookingEmailKind } from "./kinds";
import { renderBookingEmail, type EmailRecipient } from "./templates";
import { deliverEmail } from "./transport";

/** 予約に関するメール(担当: S2 ゲスト予約)。RESEND_API_KEY が無いときはログに出すだけにする */

export type { BookingEmailKind };

export interface SendBookingEmailOptions {
  /** 送る相手。省略すると種類ごとの既定(下の DEFAULT_RECIPIENTS) */
  recipients?: EmailRecipient[];
  /** キャンセル・辞退の前の状態。確定していた予約のときだけ、取り消しの .ics を付ける */
  previousStatus?: BookingRow["status"];
}

const DEFAULT_RECIPIENTS: Record<BookingEmailKind, EmailRecipient[]> = {
  booking_confirmed: ["guest", "host"],
  booking_requested: ["guest", "host"],
  booking_declined: ["guest"],
  booking_cancelled: ["guest", "host"],
  booking_rescheduled: ["guest", "host"],
  booking_reminder: ["guest", "host"],
};

/** ゲスト宛てに付ける .ics の種類。付けないときは null */
function icsMethodFor(kind: BookingEmailKind, booking: BookingRow, options: SendBookingEmailOptions): IcsMethod | null {
  switch (kind) {
    case "booking_confirmed":
    case "booking_rescheduled":
    case "booking_reminder":
      return booking.status === "confirmed" ? "REQUEST" : null;
    case "booking_cancelled":
      return (options.previousStatus ?? "confirmed") === "confirmed" ? "CANCEL" : null;
    default:
      return null;
  }
}

/** ホストのメール通知の設定。設定が読めなければ送る */
async function hostWantsEmail(db: AdminClient, hostId: string, kind: BookingEmailKind): Promise<boolean> {
  if (kind !== "booking_confirmed" && kind !== "booking_cancelled" && kind !== "booking_rescheduled") return true;
  const { data } = await db.from("user_settings").select("email_on_booking, email_on_cancel").eq("user_id", hostId).maybeSingle();
  if (!data) return true;
  return kind === "booking_cancelled" ? data.email_on_cancel : data.email_on_booking;
}

export async function sendBookingEmail(
  kind: BookingEmailKind,
  bookingId: string,
  options: SendBookingEmailOptions = {},
): Promise<void> {
  const db = createAdminClient();
  const booking = await findBookingById(db, bookingId);
  if (!booking) throw new Error(`予約が見つかりません(${bookingId})`);

  // リマインドは、確定していて、まだ始まっていない予約だけ
  if (kind === "booking_reminder" && (booking.status !== "confirmed" || new Date(booking.starts_at) <= new Date())) {
    return;
  }

  const [page, hostProfile, hostEmail, previous] = await Promise.all([
    booking.booking_page_id ? findPageById(db, booking.booking_page_id) : Promise.resolve(null),
    db.from("profiles").select("display_name, timezone").eq("id", booking.host_id).maybeSingle(),
    findHostEmail(db, booking.host_id),
    booking.rescheduled_from ? findBookingById(db, booking.rescheduled_from) : Promise.resolve(null),
  ]);
  const host = {
    display_name: hostProfile.data?.display_name || "主催者",
    timezone: hostProfile.data?.timezone ?? booking.guest_timezone,
  };

  const appUrl = publicEnv.appUrl;
  const manageUrl = `${appUrl}/b/${booking.manage_token}`;
  const base = {
    kind,
    booking,
    host,
    previous: kind === "booking_rescheduled" && previous ? { starts_at: previous.starts_at, ends_at: previous.ends_at } : null,
    formFields: parseFormFields(page?.form_fields),
    manageUrl,
    hostUrl: `${appUrl}/app/bookings?id=${booking.id}`,
    completionMessage: page?.completion_message,
  };

  const recipients = options.recipients ?? DEFAULT_RECIPIENTS[kind];
  const eventType = kind === "booking_reminder" ? "reminder_sent" : "email_sent";
  // リマインドは 1 件の予約に何度か送るので、10 分単位の時刻をキーに含める
  const keySuffix = kind === "booking_reminder" ? `:${Math.floor(Date.now() / 600_000)}` : "";

  for (const recipient of recipients) {
    if (recipient === "host") {
      if (!hostEmail || !(await hostWantsEmail(db, booking.host_id, kind))) continue;
      const content = renderBookingEmail({ ...base, recipient });
      const { delivered } = await deliverEmail({
        to: hostEmail,
        ...content,
        replyTo: booking.guest_email,
        idempotencyKey: `${booking.id}:${kind}:host${keySuffix}`,
      });
      await recordEvent(db, booking.id, eventType, "system", { kind, to: "host", delivered });
      continue;
    }

    const content = renderBookingEmail({ ...base, recipient });
    const method = icsMethodFor(kind, booking, options);
    let ics: { method: IcsMethod; content: string } | null = null;
    if (method) {
      const { rootId, generation } = await findRescheduleRoot(db, booking);
      ics = {
        method,
        content: buildIcs({
          method,
          uid: icsUid(rootId),
          sequence: icsSequence(method, generation),
          start: booking.starts_at,
          end: booking.ends_at,
          title: booking.title,
          description: `予約の確認・変更・キャンセル: ${manageUrl}`,
          location: booking.meeting_url ?? booking.location_value ?? undefined,
          url: manageUrl,
          organizer: { name: host.display_name, email: hostEmail ?? "no-reply@slotto.invalid" },
          attendee: { name: booking.guest_name, email: booking.guest_email },
        }),
      };
    }
    const { delivered } = await deliverEmail({
      to: booking.guest_email,
      ...content,
      replyTo: hostEmail,
      ics,
      idempotencyKey: `${booking.id}:${kind}:guest${keySuffix}`,
    });
    await recordEvent(db, booking.id, eventType, "system", { kind, to: "guest", delivered, ics: method });
  }
}
