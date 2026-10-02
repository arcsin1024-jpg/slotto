import "server-only";
import { computeSlots, isSlotAvailable, type Interval, type Slot } from "@slotto/core/slots";
import type { BookingPageRow, BookingRow, ProfileRow } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { toSlotPageConfig } from "./rules";

/** 予約の読み書きで使う、DB の読み出し。ゲスト向けの処理なので管理用クライアントで読む */

const DAY = 86_400_000;

export type AdminClient = ReturnType<typeof createAdminClient>;

export async function findHostByUsername(db: AdminClient, username: string): Promise<ProfileRow | null> {
  const { data, error } = await db.from("profiles").select("*").eq("username", username.toLowerCase()).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findPage(db: AdminClient, ownerId: string, slug: string): Promise<BookingPageRow | null> {
  const { data, error } = await db
    .from("booking_pages")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("slug", slug.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function findPageById(db: AdminClient, id: string): Promise<BookingPageRow | null> {
  const { data, error } = await db.from("booking_pages").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findBookingByToken(db: AdminClient, token: string): Promise<BookingRow | null> {
  // トークンは 48 文字の 16 進数。形が違えば DB を引かない
  if (!/^[0-9a-f]{48}$/.test(token)) return null;
  const { data, error } = await db.from("bookings").select("*").eq("manage_token", token).maybeSingle();
  if (error) throw error;
  return data;
}

export async function findBookingById(db: AdminClient, id: string): Promise<BookingRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await db.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

interface BusyInput {
  page: BookingPageRow;
  from: Date;
  to: Date;
  /** 日程変更のとき、元の予約をふさがっている時間に含めない */
  excludeBookingId?: string;
}

/**
 * 空き枠の計算に渡す、ふさがっている時間帯。
 * - bookings: この予約ページの有効な予約(1 日の上限の数え上げにも使う)
 * - externalBusy: 反映中(is_selected = true)の外部予定 + 同じホストの他の予約ページの有効な予約。
 *   選んでいない外部予定は使わない
 */
async function loadBusy(db: AdminClient, input: BusyInput) {
  const { page } = input;
  // 前後の空きと 1 日の上限の数え上げのため、前後に 1 日ずつ広げて読む
  const from = new Date(input.from.getTime() - DAY).toISOString();
  const to = new Date(input.to.getTime() + DAY).toISOString();

  const [bookingsResult, eventsResult, candidatesResult] = await Promise.all([
    db
      .from("bookings")
      .select("id, booking_page_id, starts_at, ends_at")
      .eq("host_id", page.owner_id)
      .in("status", ["pending", "confirmed"])
      .lt("starts_at", to)
      .gt("ends_at", from),
    db
      .from("external_events")
      .select("starts_at, ends_at")
      .eq("user_id", page.owner_id)
      .eq("is_selected", true)
      .lt("starts_at", to)
      .gt("ends_at", from),
    page.slot_mode === "candidates"
      ? db
          .from("booking_page_candidates")
          .select("starts_at, ends_at")
          .eq("booking_page_id", page.id)
          .lt("starts_at", to)
          .gt("ends_at", from)
      : Promise.resolve({ data: [] as { starts_at: string; ends_at: string }[], error: null }),
  ]);
  if (bookingsResult.error) throw bookingsResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (candidatesResult.error) throw candidatesResult.error;

  const toInterval = (row: { starts_at: string; ends_at: string }): Interval => ({
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
  });

  const ownBookings: Interval[] = [];
  const otherBusy: Interval[] = eventsResult.data.map(toInterval);
  for (const row of bookingsResult.data) {
    if (row.id === input.excludeBookingId) continue;
    if (row.booking_page_id === page.id) ownBookings.push(toInterval(row));
    else otherBusy.push(toInterval(row));
  }

  return {
    bookings: ownBookings,
    externalBusy: otherBusy,
    candidates: candidatesResult.data.map(toInterval),
  };
}

/** 対象期間の空き枠 */
export async function loadSlots(db: AdminClient, input: BusyInput & { now: Date }): Promise<Slot[]> {
  const busy = await loadBusy(db, input);
  return computeSlots({ page: toSlotPageConfig(input.page), from: input.from, to: input.to, now: input.now, ...busy });
}

/** 指定した開始時刻の枠がまだ空いているか。空いていれば枠(終了時刻つき)を返す */
export async function checkSlot(
  db: AdminClient,
  page: BookingPageRow,
  startsAt: Date,
  now: Date,
  excludeBookingId?: string,
): Promise<Slot | null> {
  const busy = await loadBusy(db, {
    page,
    from: new Date(startsAt.getTime() - DAY),
    to: new Date(startsAt.getTime() + DAY),
    excludeBookingId,
  });
  return isSlotAvailable({ page: toSlotPageConfig(page), now, ...busy }, startsAt);
}

/** 日程変更でつながる一連の予約の、最初の予約の ID と世代(.ics の UID と SEQUENCE に使う) */
export async function findRescheduleRoot(
  db: AdminClient,
  booking: Pick<BookingRow, "id" | "rescheduled_from">,
): Promise<{ rootId: string; generation: number }> {
  let rootId = booking.id;
  let previous = booking.rescheduled_from;
  let generation = 0;
  // 念のため、たどる回数に上限を置く
  while (previous && generation < 50) {
    const { data, error } = await db.from("bookings").select("id, rescheduled_from").eq("id", previous).maybeSingle();
    if (error) throw error;
    if (!data) break;
    rootId = data.id;
    previous = data.rescheduled_from;
    generation += 1;
  }
  return { rootId, generation };
}

/** ホストのメールアドレス(認証のユーザー情報から読む) */
export async function findHostEmail(db: AdminClient, hostId: string): Promise<string | null> {
  const { data, error } = await db.auth.admin.getUserById(hostId);
  if (error) return null;
  return data.user?.email ?? null;
}
