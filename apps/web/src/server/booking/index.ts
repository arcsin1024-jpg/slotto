import "server-only";
import type { BookingAnswers, CreateBookingInput } from "@slotto/core";
import type { BookingPageRow, BookingRow } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  checkSlot,
  findBookingById,
  findBookingByToken,
  findHostByUsername,
  findPage,
  findPageById,
  type AdminClient,
} from "./data";
import { recordEvent } from "./events";
import { guestChangeState, isValidTimeZone, parseFormFields, validateAnswers } from "./rules";
import { afterCancelled, afterConfirmed, afterRequested } from "./side-effects";

/**
 * 予約の作成と操作(担当: S2 ゲスト予約)。
 * 関数の名前と引数は変えない。変えたいときは報告する(docs/plan.md の 3 章)。
 *
 * DB の書き込みは管理用クライアントで行う。ホストの操作は hostId と予約の host_id が一致するかを必ず確かめる。
 * 確定のあとのカレンダー・メール・ジョブ・通知は side-effects.ts。これらが失敗しても予約は失敗させない。
 */

export type BookingResult =
  | { ok: true; booking: BookingRow }
  | { ok: false; code: "not_found" | "slot_taken" | "invalid" | "forbidden" | "too_late"; message: string };

type Failure = Extract<BookingResult, { ok: false }>;

const fail = (code: Failure["code"], message: string): Failure => ({ ok: false, code, message });

const MESSAGES = {
  pageNotFound: "予約ページが見つからないか、受付を停止しています",
  bookingNotFound: "予約が見つかりません",
  slotTaken: "この時間はすでに埋まりました。別の時間を選んでください",
  notActive: "この予約はすでにキャンセル済みか、変更されています",
  tooLate: "変更・キャンセルの期限を過ぎています。主催者に直接ご連絡ください",
  cancelNotAllowed: "この予約はキャンセルを受け付けていません。主催者に直接ご連絡ください",
  rescheduleNotAllowed: "この予約は日程の変更を受け付けていません",
  notPending: "承認待ちの予約ではありません",
  alreadyStarted: "開始時刻を過ぎた予約は操作できません",
  forbidden: "この予約を操作する権限がありません",
} as const;

// ---------------------------------------------------------------------------
// create_booking(supabase/migrations/20261003000000_create_booking.sql)
// packages/core/src/database.ts に関数の型が入るまで、ここで型を当てる
// ---------------------------------------------------------------------------

interface CreateBookingRpcArgs {
  p_page_id: string;
  p_starts_at: string;
  p_ends_at: string;
  p_guest_name: string;
  p_guest_email: string;
  p_guest_timezone: string;
  p_answers: BookingAnswers;
  p_rescheduled_from?: string | null;
}

type CreateBookingRpc = (
  fn: "create_booking",
  args: CreateBookingRpcArgs,
) => PromiseLike<{ data: BookingRow | BookingRow[] | null; error: { code?: string; message: string } | null }>;

async function insertBooking(db: AdminClient, args: CreateBookingRpcArgs): Promise<BookingResult> {
  const rpc = db.rpc.bind(db) as unknown as CreateBookingRpc;
  const { data, error } = await rpc("create_booking", args);
  if (error) {
    switch (error.message) {
      case "slot_taken":
        return fail("slot_taken", MESSAGES.slotTaken);
      case "page_not_found":
      case "page_inactive":
        return fail("not_found", MESSAGES.pageNotFound);
      case "invalid_reschedule":
        return fail("invalid", MESSAGES.notActive);
    }
    if (error.code === "23P01") return fail("slot_taken", MESSAGES.slotTaken);
    throw new Error(`予約を作成できませんでした: ${error.message}`);
  }
  const booking = Array.isArray(data) ? data[0] : data;
  if (!booking) throw new Error("予約を作成できませんでした: 結果が空です");
  return { ok: true, booking };
}

/** 新しい予約・日程変更でできた予約の後処理。確定なら確定の、承認待ちなら申請の処理をする */
async function afterCreated(
  db: AdminClient,
  booking: BookingRow,
  page: BookingPageRow,
  previous: BookingRow | null,
): Promise<BookingRow> {
  if (booking.status === "confirmed") {
    return afterConfirmed(db, booking, page, previous ? "rescheduled" : "created", previous);
  }
  await afterRequested(db, booking, previous);
  return booking;
}

/** ゲストの予約。空き枠を計算し直し、排他制約で二重予約を防ぐ */
export async function createBooking(input: CreateBookingInput): Promise<BookingResult> {
  const db = createAdminClient();
  const now = new Date();

  const host = await findHostByUsername(db, input.username);
  if (!host || !host.onboarded_at) return fail("not_found", MESSAGES.pageNotFound);
  const page = await findPage(db, host.id, input.slug);
  if (!page || !page.is_active) return fail("not_found", MESSAGES.pageNotFound);

  const answers = validateAnswers(parseFormFields(page.form_fields), input.answers);
  if (!answers.ok) return fail("invalid", answers.message);

  const startsAt = new Date(input.starts_at);
  const slot = await checkSlot(db, page, startsAt, now);
  if (!slot) return fail("slot_taken", MESSAGES.slotTaken);

  const result = await insertBooking(db, {
    p_page_id: page.id,
    p_starts_at: slot.start,
    p_ends_at: slot.end,
    p_guest_name: input.guest_name.trim(),
    p_guest_email: input.guest_email.trim(),
    p_guest_timezone: isValidTimeZone(input.guest_timezone) ? input.guest_timezone : page.timezone,
    p_answers: answers.answers,
  });
  if (!result.ok) return result;

  return { ok: true, booking: await afterCreated(db, result.booking, page, null) };
}

/** ホストの操作の前に、予約を読んで持ち主を確かめる */
async function loadHostBooking(db: AdminClient, hostId: string, bookingId: string): Promise<BookingResult> {
  const booking = await findBookingById(db, bookingId);
  if (!booking) return fail("not_found", MESSAGES.bookingNotFound);
  if (booking.host_id !== hostId) return fail("forbidden", MESSAGES.forbidden);
  return { ok: true, booking };
}

/**
 * 状態を条件付きで更新する。同時に別の操作が入って状態が変わっていたら null。
 * 1 つの UPDATE 文なので、承認とキャンセルが同時に来ても片方だけが通る。
 */
async function transition(
  db: AdminClient,
  booking: BookingRow,
  from: BookingRow["status"][],
  patch: Partial<BookingRow>,
): Promise<BookingRow | null> {
  const { data, error } = await db
    .from("bookings")
    .update(patch)
    .eq("id", booking.id)
    .in("status", from)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** ホストが承認する(承認制の予約ページ) */
export async function approveBooking(hostId: string, bookingId: string): Promise<BookingResult> {
  const db = createAdminClient();
  const loaded = await loadHostBooking(db, hostId, bookingId);
  if (!loaded.ok) return loaded;
  const { booking } = loaded;
  if (booking.status !== "pending") return fail("invalid", MESSAGES.notPending);
  if (new Date(booking.starts_at) <= new Date()) return fail("too_late", MESSAGES.alreadyStarted);

  const approved = await transition(db, booking, ["pending"], { status: "confirmed" });
  if (!approved) return fail("invalid", MESSAGES.notPending);
  await recordEvent(db, booking.id, "approved", "host");

  const page = booking.booking_page_id ? await findPageById(db, booking.booking_page_id) : null;
  return { ok: true, booking: await afterConfirmed(db, approved, page, "approved") };
}

/** ホストが辞退する */
export async function declineBooking(hostId: string, bookingId: string, reason?: string): Promise<BookingResult> {
  const db = createAdminClient();
  const loaded = await loadHostBooking(db, hostId, bookingId);
  if (!loaded.ok) return loaded;
  const { booking } = loaded;
  if (booking.status !== "pending") return fail("invalid", MESSAGES.notPending);

  const cancelReason = reason?.trim() || null;
  const declined = await transition(db, booking, ["pending"], {
    status: "declined",
    cancelled_at: new Date().toISOString(),
    cancelled_by: "host",
    cancel_reason: cancelReason,
  });
  if (!declined) return fail("invalid", MESSAGES.notPending);
  await recordEvent(db, booking.id, "declined", "host", { reason: cancelReason });

  await afterCancelled(db, declined, "declined", "pending");
  return { ok: true, booking: declined };
}

/** キャンセル。by が guest のときは manage_token で本人を確かめる */
export async function cancelBooking(
  target: { by: "host"; hostId: string; bookingId: string } | { by: "guest"; token: string },
  reason?: string,
): Promise<BookingResult> {
  const db = createAdminClient();
  const now = new Date();

  let booking: BookingRow;
  if (target.by === "host") {
    const loaded = await loadHostBooking(db, target.hostId, target.bookingId);
    if (!loaded.ok) return loaded;
    booking = loaded.booking;
    if (booking.status !== "pending" && booking.status !== "confirmed") return fail("invalid", MESSAGES.notActive);
    // ホストは期限に関係なく取り消せる。終わった予約は取り消さない
    if (new Date(booking.ends_at) <= now) return fail("too_late", MESSAGES.alreadyStarted);
  } else {
    const found = await findBookingByToken(db, target.token);
    if (!found) return fail("not_found", MESSAGES.bookingNotFound);
    booking = found;
    if (booking.status !== "pending" && booking.status !== "confirmed") return fail("invalid", MESSAGES.notActive);
    const page = booking.booking_page_id ? await findPageById(db, booking.booking_page_id) : null;
    const state = guestChangeState(booking, page, now);
    if (state.isPastDeadline) return fail("too_late", MESSAGES.tooLate);
    if (!state.canCancel) return fail("forbidden", MESSAGES.cancelNotAllowed);
  }

  const previousStatus = booking.status;
  const cancelReason = reason?.trim() || null;
  const cancelled = await transition(db, booking, ["pending", "confirmed"], {
    status: "cancelled",
    cancelled_at: now.toISOString(),
    cancelled_by: target.by,
    cancel_reason: cancelReason,
  });
  if (!cancelled) return fail("invalid", MESSAGES.notActive);
  await recordEvent(db, booking.id, "cancelled", target.by, { reason: cancelReason, previous_status: previousStatus });

  await afterCancelled(db, cancelled, "cancelled", previousStatus);
  return { ok: true, booking: cancelled };
}

/** 日程変更(ゲストのみ)。新しい予約を作り、元の予約を取り消す */
export async function rescheduleBooking(token: string, startsAt: string): Promise<BookingResult> {
  const db = createAdminClient();
  const now = new Date();

  const booking = await findBookingByToken(db, token);
  if (!booking) return fail("not_found", MESSAGES.bookingNotFound);
  if (booking.status !== "pending" && booking.status !== "confirmed") return fail("invalid", MESSAGES.notActive);
  const page = booking.booking_page_id ? await findPageById(db, booking.booking_page_id) : null;
  const state = guestChangeState(booking, page, now);
  if (state.isPastDeadline) return fail("too_late", MESSAGES.tooLate);
  if (!page || !state.canReschedule) return fail("forbidden", MESSAGES.rescheduleNotAllowed);

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return fail("invalid", "日時の形式が正しくありません");
  if (start.getTime() === new Date(booking.starts_at).getTime()) return fail("invalid", "いまと同じ日時です");

  // 元の予約は、ふさがっている時間に含めずに計算する
  const slot = await checkSlot(db, page, start, now, booking.id);
  if (!slot) return fail("slot_taken", MESSAGES.slotTaken);

  const result = await insertBooking(db, {
    p_page_id: page.id,
    p_starts_at: slot.start,
    p_ends_at: slot.end,
    p_guest_name: booking.guest_name,
    p_guest_email: booking.guest_email,
    p_guest_timezone: booking.guest_timezone,
    p_answers: (booking.answers ?? {}) as BookingAnswers,
    p_rescheduled_from: booking.id,
  });
  if (!result.ok) return result;

  return { ok: true, booking: await afterCreated(db, result.booking, page, booking) };
}

export type { BookingAnswers };
export { getPublicBooking, getPublicPage, getPublicProfile, getPublicSlots, toPublicBooking } from "./public";
