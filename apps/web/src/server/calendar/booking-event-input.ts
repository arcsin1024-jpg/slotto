import type { BookingRow } from "@slotto/core/database";
import type { GoogleEvent, GoogleEventInput } from "./google/types";
import { SLOTTO_BOOKING_PROPERTY } from "./normalize";

/**
 * 予約 ID から Google の予定 ID を作る。
 * Google の予定 ID は base32hex の文字(a〜v と 0〜9)で 5〜1024 文字。UUID の 16 進表記はこの条件を満たす。
 */
export function bookingEventId(bookingId: string): string {
  return bookingId.replaceAll("-", "").toLowerCase();
}

type BookingForEvent = Pick<
  BookingRow,
  "id" | "title" | "starts_at" | "ends_at" | "guest_name" | "guest_email" | "location_type" | "location_value"
>;

/** 予約から、外部カレンダーに書き込む予定の内容を作る */
export function buildBookingEventInput(
  booking: BookingForEvent,
  options: { id?: string; withMeet: boolean },
): GoogleEventInput {
  const location =
    booking.location_type === "in_person" || booking.location_type === "phone" || booking.location_type === "custom_url"
      ? booking.location_value || null
      : null;

  return {
    ...(options.id ? { id: options.id } : {}),
    summary: `${booking.title}(${booking.guest_name} 様)`,
    description: [`Slotto で予約されました。`, `ゲスト: ${booking.guest_name} <${booking.guest_email}>`].join("\n"),
    location,
    start: { dateTime: new Date(booking.starts_at).toISOString() },
    end: { dateTime: new Date(booking.ends_at).toISOString() },
    // ゲストを参加者に入れる(Meet に待たずに入れるように)。招待メールは Slotto から送るので Google からは送らない
    attendees: [{ email: booking.guest_email, displayName: booking.guest_name }],
    extendedProperties: { private: { [SLOTTO_BOOKING_PROPERTY]: booking.id } },
    ...(options.withMeet
      ? {
          conferenceData: {
            createRequest: {
              // 同じ予約で再送しても会議が二重に作られないよう、予約 ID から作る
              requestId: `slotto-${booking.id}`,
              conferenceSolutionKey: { type: "hangoutsMeet" as const },
            },
          },
        }
      : {}),
  };
}

/** 予定から会議 URL(Google Meet)を取り出す */
export function meetingUrlOf(event: GoogleEvent): string | null {
  return (
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri ??
    null
  );
}
