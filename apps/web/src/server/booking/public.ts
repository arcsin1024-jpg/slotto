import "server-only";
import type { LocationType } from "@slotto/core";
import type { BookingPageRow, BookingRow, ProfileRow } from "@slotto/core/database";
import type { PublicBooking, PublicBookingPage, PublicHost, PublicPageResponse, PublicSlotsResponse } from "@/features/booking/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { findBookingByToken, findHostByUsername, findPage, findPageById, loadSlots, type AdminClient } from "./data";
import { guestChangeState, parseFormFields } from "./rules";

/** ゲスト向けの読み出し。必要な項目だけを取り出して返す(公開 API と予約ページの画面で使う) */

const DAY = 86_400_000;
/** 1 回に返す空き枠の期間の上限 */
const MAX_RANGE_DAYS = 62;

function toPublicHost(profile: ProfileRow): PublicHost {
  return {
    username: profile.username ?? "",
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    bio: profile.bio,
  };
}

function toPublicPage(page: BookingPageRow): PublicBookingPage {
  return {
    slug: page.slug,
    title: page.title,
    description: page.description,
    color: page.color,
    kind: page.kind,
    duration_minutes: page.duration_minutes,
    location_type: page.location_type,
    confirmation_mode: page.confirmation_mode,
    form_fields: parseFormFields(page.form_fields),
    timezone: page.timezone,
    max_days_ahead: page.max_days_ahead,
  };
}

async function findActivePage(db: AdminClient, username: string, slug: string) {
  const host = await findHostByUsername(db, username);
  if (!host || !host.onboarded_at) return null;
  const page = await findPage(db, host.id, slug);
  if (!page || !page.is_active) return null;
  return { host, page };
}

/** ホストの公開プロフィール(/{username})。公開中の予約ページの一覧つき */
export async function getPublicProfile(
  username: string,
): Promise<{ host: PublicHost; pages: PublicBookingPage[] } | null> {
  const db = createAdminClient();
  const host = await findHostByUsername(db, username);
  if (!host || !host.onboarded_at) return null;
  const { data, error } = await db
    .from("booking_pages")
    .select("*")
    .eq("owner_id", host.id)
    .eq("is_active", true)
    // 1 回限りの予約ページは URL を知っている人だけに見せる
    .eq("kind", "recurring")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return { host: toPublicHost(host), pages: data.map(toPublicPage) };
}

/** 予約ページの公開情報。見つからない・受付停止中なら null */
export async function getPublicPage(username: string, slug: string): Promise<PublicPageResponse | null> {
  const found = await findActivePage(createAdminClient(), username, slug);
  if (!found) return null;
  return { host: toPublicHost(found.host), page: toPublicPage(found.page) };
}

/**
 * 空き枠。期間を省略すると、今から受付期限まで。期間は最長 62 日に切り詰める。
 * 日程変更のときは excludeToken に元の予約のトークンを渡すと、その予約の時間も空きとして出す。
 */
export async function getPublicSlots(
  username: string,
  slug: string,
  range: { from?: Date; to?: Date; excludeToken?: string } = {},
): Promise<PublicSlotsResponse | null> {
  const db = createAdminClient();
  const now = new Date();
  const host = await findHostByUsername(db, username);
  if (!host || !host.onboarded_at) return null;
  const page = await findPage(db, host.id, slug);
  if (!page) return null;

  let excludeBookingId: string | undefined;
  if (range.excludeToken) {
    const booking = await findBookingByToken(db, range.excludeToken);
    if (booking && booking.booking_page_id === page.id && (booking.status === "pending" || booking.status === "confirmed")) {
      excludeBookingId = booking.id;
    }
  }
  // 受付停止中は空き枠を出さない(1 回限りの予約ページの日程変更だけは出す)
  if (!page.is_active && !(page.kind === "one_time" && excludeBookingId)) return null;

  const from = range.from && range.from > now ? range.from : now;
  const limit = new Date(now.getTime() + (page.max_days_ahead + 1) * DAY);
  let to = range.to && range.to < limit ? range.to : limit;
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY) to = new Date(from.getTime() + MAX_RANGE_DAYS * DAY);
  if (to <= from) return { slots: [], from: from.toISOString(), to: from.toISOString() };

  const slots = await loadSlots(db, { page, from, to, now, excludeBookingId });
  return { slots, from: from.toISOString(), to: to.toISOString() };
}

/** 予約の確認・変更・キャンセル画面(/b/{token})用。見つからなければ null */
export async function getPublicBooking(token: string): Promise<PublicBooking | null> {
  const db = createAdminClient();
  const booking = await findBookingByToken(db, token);
  if (!booking) return null;
  return toPublicBooking(db, booking);
}

export async function toPublicBooking(db: AdminClient, booking: BookingRow): Promise<PublicBooking> {
  const [page, hostResult, nextResult] = await Promise.all([
    booking.booking_page_id ? findPageById(db, booking.booking_page_id) : Promise.resolve(null),
    db.from("profiles").select("display_name, username").eq("id", booking.host_id).maybeSingle(),
    db.from("bookings").select("manage_token").eq("rescheduled_from", booking.id).order("created_at", { ascending: false }).limit(1),
  ]);
  const state = guestChangeState(booking, page, new Date());
  const confirmed = booking.status === "confirmed";

  return {
    token: booking.manage_token,
    title: booking.title,
    status: booking.status,
    starts_at: booking.starts_at,
    ends_at: booking.ends_at,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_timezone: booking.guest_timezone,
    location_type: booking.location_type as LocationType,
    location_value: confirmed ? booking.location_value : null,
    meeting_url: confirmed ? booking.meeting_url : null,
    cancelled_at: booking.cancelled_at,
    cancelled_by: booking.cancelled_by,
    host: { display_name: hostResult.data?.display_name ?? "", username: hostResult.data?.username ?? null },
    page: page
      ? {
          slug: page.slug,
          duration_minutes: page.duration_minutes,
          timezone: page.timezone,
          completion_message: page.completion_message,
        }
      : null,
    can_cancel: state.canCancel,
    can_reschedule: state.canReschedule,
    change_deadline: state.deadline?.toISOString() ?? null,
    rescheduled_to_token: nextResult.data?.[0]?.manage_token ?? null,
  };
}
