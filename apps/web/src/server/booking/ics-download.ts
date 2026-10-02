import "server-only";
import { publicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildIcs, icsSequence, icsUid } from "@/server/email/ics";
import { findBookingByToken, findHostEmail, findRescheduleRoot } from "./data";

/**
 * 完了画面と確認画面の「カレンダーアプリに追加」用の .ics。確定した予約だけ。
 * メールに付けるものと同じ UID・SEQUENCE にして、あとの変更・キャンセルのメールで上書きされるようにする。
 */
export async function getBookingIcs(token: string): Promise<string | null> {
  const db = createAdminClient();
  const booking = await findBookingByToken(db, token);
  if (!booking || booking.status !== "confirmed") return null;

  const [{ rootId, generation }, hostEmail, hostProfile] = await Promise.all([
    findRescheduleRoot(db, booking),
    findHostEmail(db, booking.host_id),
    db.from("profiles").select("display_name").eq("id", booking.host_id).maybeSingle(),
  ]);
  const manageUrl = `${publicEnv.appUrl}/b/${booking.manage_token}`;
  return buildIcs({
    method: "REQUEST",
    uid: icsUid(rootId),
    sequence: icsSequence("REQUEST", generation),
    start: booking.starts_at,
    end: booking.ends_at,
    title: booking.title,
    description: `予約の確認・変更・キャンセル: ${manageUrl}`,
    location: booking.meeting_url ?? booking.location_value ?? undefined,
    url: manageUrl,
    organizer: { name: hostProfile.data?.display_name || "主催者", email: hostEmail ?? "no-reply@slotto.invalid" },
    attendee: { name: booking.guest_name, email: booking.guest_email },
  });
}
