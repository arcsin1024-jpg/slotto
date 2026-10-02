import "server-only";
import type { ScheduledJobKind } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  loadBooking,
  loadEnabledAutomations,
  loadExternalEvent,
  loadSourceDetails,
  loadUserTimezone,
  loadAutomation,
  parseAutomation,
  toScheduleSource,
  type ParsedAutomation,
} from "@/server/automations/sources";
import { isPlannedAutomationKey, jobKeys } from "./keys";
import {
  desiredDailyJobs,
  desiredReminderJobs,
  desiredTimedAutomationJobs,
  type AutomationJobPayload,
  type DesiredJob,
  type PlannableAutomation,
} from "./plan";
import {
  cancelJobsByPrefix,
  findJobsByPrefix,
  findPendingJobsForUser,
  insertJobIfAbsent,
  syncJobs,
  toJson,
  upsertDebouncedJob,
  upsertJob,
} from "./store";
import { matchesTarget } from "./timing";

/** 時刻指定の実行(担当: S4 実行基盤) */

export interface EnqueueJobInput {
  kind: ScheduledJobKind;
  runAt: Date;
  userId?: string;
  payload?: Record<string, unknown>;
  /** 同じキーのジョブがあれば上書きする。取り消しにも使う(例: "booking:<id>:reminder:1440") */
  dedupeKey?: string;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<void> {
  const payload = input.payload ?? {};
  if (input.dedupeKey) {
    await upsertJob({
      dedupeKey: input.dedupeKey,
      kind: input.kind,
      userId: input.userId ?? null,
      runAt: input.runAt,
      scheduledFor: input.runAt,
      payload,
      maxAttempts: 3,
    });
    return;
  }
  const { error } = await createAdminClient()
    .from("scheduled_jobs")
    .insert({ kind: input.kind, run_at: input.runAt.toISOString(), user_id: input.userId ?? null, payload: toJson(payload) });
  if (error) throw new Error(`ジョブを入れられません: ${error.message}`);
}

/** dedupe_key が prefix で始まる、未実行のジョブを取り消す */
export async function cancelJobs(dedupeKeyPrefix: string): Promise<void> {
  await cancelJobsByPrefix(dedupeKeyPrefix);
}

const plannable = (a: ParsedAutomation): PlannableAutomation => ({
  id: a.row.id,
  userId: a.row.user_id,
  trigger: a.trigger,
  target: a.target,
});

/**
 * アプリに予定の変化を知らせる(サイレントなプッシュ)。アプリはローカル通知・アラームを張り直す。
 * 短い間に何度呼ばれても 1 回にまとめる。
 */
export async function requestDeviceSync(userId: string, reason: string): Promise<void> {
  await upsertDebouncedJob({
    dedupeKey: jobKeys.userSync(userId),
    kind: "push_notification",
    userId,
    runAt: new Date(),
    scheduledFor: new Date(),
    payload: { sync: true, reason },
    maxAttempts: 3,
  });
}

/**
 * 予約に関するジョブ(メールのリマインド、通知・アラーム、オートメーション)をまとめて入れ直す。
 * 予約の確定・承認・日程変更のあとに呼ぶ。
 */
export async function scheduleBookingJobs(bookingId: string): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  const { row, details } = booking;
  const now = new Date();

  const desired: DesiredJob[] = [];
  if (row.status === "confirmed") {
    let reminderMinutes: number[] = [];
    if (row.booking_page_id) {
      const { data: page } = await createAdminClient()
        .from("booking_pages")
        .select("reminder_minutes")
        .eq("id", row.booking_page_id)
        .maybeSingle();
      reminderMinutes = page?.reminder_minutes ?? [];
    }
    desired.push(...desiredReminderJobs({ id: row.id, hostId: row.host_id, startsAt: new Date(row.starts_at) }, reminderMinutes, now));
    const automations = (await loadEnabledAutomations(row.host_id)).map(plannable);
    desired.push(...desiredTimedAutomationJobs(automations, [toScheduleSource(details)], now));
  }

  // 確定していない予約(承認待ち、キャンセル、辞退)は、待機中のジョブを取り消すだけになる
  await syncJobs(desired, await findJobsByPrefix(jobKeys.bookingPrefix(bookingId)));
  await requestDeviceSync(row.host_id, "booking");
}

/** 予約に関するジョブをまとめて取り消す。キャンセル・辞退のあとに呼ぶ */
export async function cancelBookingJobs(bookingId: string): Promise<void> {
  await cancelJobsByPrefix(jobKeys.bookingPrefix(bookingId));
  const { data } = await createAdminClient().from("bookings").select("host_id").eq("id", bookingId).maybeSingle();
  if (data) await requestDeviceSync(data.host_id, "booking");
}

/** 予約が入った・キャンセルされたときに動くオートメーションを実行する(ジョブに入れ、次の dispatch で動く) */
export async function triggerBookingAutomations(
  event: "booking_created" | "booking_cancelled",
  bookingId: string,
): Promise<void> {
  const booking = await loadBooking(bookingId);
  if (!booking) return;
  const source = toScheduleSource(booking.details);
  const now = new Date();
  const automations = (await loadEnabledAutomations(booking.row.host_id)).filter(
    (a) => a.trigger.type === event && matchesTarget(a.target, source),
  );
  for (const automation of automations) {
    const payload: AutomationJobPayload & { trigger_event: typeof event } = {
      automation_id: automation.row.id,
      source_type: "booking",
      source_id: bookingId,
      scheduled_for: now.toISOString(),
      trigger_event: event,
    };
    await insertJobIfAbsent({
      dedupeKey: jobKeys.bookingTrigger(bookingId, event === "booking_created" ? "created" : "cancelled", automation.row.id),
      kind: "automation_run",
      userId: booking.row.host_id,
      runAt: now,
      scheduledFor: now,
      payload: { ...payload },
      maxAttempts: 1,
    });
  }
}

/**
 * 外部予定の選択・解除・変更・削除のあとに呼ぶ(S3 から)。
 * 反映中の外部予定に対する時刻型のオートメーションを入れ直し、アプリに同期を知らせる。
 * eventIds には、変わった予定の ID を渡す(削除した予定の ID も渡してよい)。省くとユーザーの全予定を見直す。
 *
 * DB のトリガー(external_events の変更)でも同じ入れ直しが予約されるので、呼び忘れても次の dispatch で追いつく。
 */
export async function scheduleExternalEventJobs(userId: string, eventIds?: string[]): Promise<void> {
  if (!eventIds || eventIds.length > 50) {
    await rescheduleUserAutomations(userId);
    await requestDeviceSync(userId, "external_events");
    return;
  }
  const now = new Date();
  const automations = (await loadEnabledAutomations(userId)).map(plannable);
  for (const eventId of new Set(eventIds)) {
    const event = await loadExternalEvent(eventId);
    const desired =
      event && event.row.user_id === userId && event.row.is_selected
        ? desiredTimedAutomationJobs(automations, [toScheduleSource(event.details)], now)
        : [];
    await syncJobs(desired, await findJobsByPrefix(jobKeys.eventPrefix(eventId)));
  }
  await requestDeviceSync(userId, "external_events");
}

/**
 * ユーザーのオートメーションのジョブ(時刻型と毎日)を、いまの設定と予定に合わせて入れ直す。
 * オートメーションの作成・変更・削除や外部予定の変化のあと、DB のトリガーが入れるジョブから呼ばれる。
 */
export async function rescheduleUserAutomations(userId: string): Promise<{ inserted: number; reset: number; cancelled: number }> {
  const now = new Date();
  const [automations, timeZone, details] = await Promise.all([
    loadEnabledAutomations(userId),
    loadUserTimezone(userId),
    loadSourceDetails(userId, { now }),
  ]);
  const list = automations.map(plannable);
  const desired = [
    ...desiredTimedAutomationJobs(list, details.map(toScheduleSource), now),
    ...desiredDailyJobs(list, timeZone, now),
  ];
  const scope = (await findPendingJobsForUser(userId, "automation_run")).filter(
    (job) => job.dedupe_key !== null && isPlannedAutomationKey(job.dedupe_key),
  );
  return syncJobs(desired, scope);
}

/** 毎日のオートメーションの次の回を入れる(実行のあとに呼ぶ) */
export async function scheduleNextDaily(automationId: string): Promise<void> {
  const row = await loadAutomation(automationId);
  const automation = row ? parseAutomation(row) : null;
  if (!row || !automation || !row.is_enabled || automation.trigger.type !== "daily") return;
  const timeZone = await loadUserTimezone(row.user_id);
  const desired = desiredDailyJobs([plannable(automation)], timeZone, new Date());
  // 前の回(済み)は残し、待機中の古い回だけを取り消す
  const scope = (await findJobsByPrefix(jobKeys.dailyPrefix(automationId))).filter((j) => j.status === "pending");
  await syncJobs(desired, scope);
}
