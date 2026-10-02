import type { AutomationTarget, AutomationTrigger } from "@slotto/core";
import type { ScheduledJobKind, ScheduledJobRow } from "@slotto/core/database";
import { jobKeys } from "./keys";
import {
  computeTriggerTime,
  isTimedTrigger,
  matchesTarget,
  nextDailyOccurrence,
  resolveRunAt,
  type ScheduleSource,
} from "./timing";

/**
 * 入れるべきジョブの一覧を作り、いまのジョブとの差分を出す。純粋な関数だけを置く(単体テストの対象)。
 */

export interface DesiredJob {
  dedupeKey: string;
  kind: ScheduledJobKind;
  userId: string | null;
  runAt: Date;
  /** 本来の実行時刻。同じ回かどうかの判定に使う(payload.scheduled_for にも入れる) */
  scheduledFor: Date;
  payload: Record<string, unknown>;
  maxAttempts: number;
}

/** オートメーションの、スケジュールに関わる部分 */
export interface PlannableAutomation {
  id: string;
  userId: string;
  trigger: AutomationTrigger;
  target: AutomationTarget;
}

/** 自動実行のジョブの payload */
export interface AutomationJobPayload {
  automation_id: string;
  source_type: "booking" | "external_event" | "schedule";
  source_id: string | null;
  scheduled_for: string;
}

/** 予約のメールのリマインド */
export function desiredReminderJobs(
  booking: { id: string; hostId: string; startsAt: Date },
  reminderMinutes: number[],
  now: Date,
): DesiredJob[] {
  const jobs: DesiredJob[] = [];
  for (const minutes of new Set(reminderMinutes)) {
    if (!Number.isInteger(minutes) || minutes <= 0) continue;
    const scheduledFor = new Date(booking.startsAt.getTime() - minutes * 60_000);
    const runAt = resolveRunAt({ type: "reminder" }, scheduledFor, null, now);
    if (!runAt) continue;
    jobs.push({
      dedupeKey: jobKeys.bookingReminder(booking.id, minutes),
      kind: "reminder_email",
      userId: booking.hostId,
      runAt,
      scheduledFor,
      payload: {
        booking_id: booking.id,
        minutes,
        starts_at: booking.startsAt.toISOString(),
        scheduled_for: scheduledFor.toISOString(),
      },
      maxAttempts: 3,
    });
  }
  return jobs;
}

/** 時刻型のオートメーション × 予定 */
export function desiredTimedAutomationJobs(
  automations: PlannableAutomation[],
  sources: ScheduleSource[],
  now: Date,
): DesiredJob[] {
  const jobs: DesiredJob[] = [];
  for (const automation of automations) {
    const trigger = automation.trigger;
    if (!isTimedTrigger(trigger)) continue;
    for (const source of sources) {
      // 終日の予定には時刻がないので、時刻型のオートメーションは動かさない
      if (source.isAllDay) continue;
      if (!matchesTarget(automation.target, source)) continue;
      const scheduledFor = computeTriggerTime(trigger, source);
      const runAt = resolveRunAt(trigger, scheduledFor, source, now);
      if (!runAt) continue;
      const payload: AutomationJobPayload = {
        automation_id: automation.id,
        source_type: source.type,
        source_id: source.id,
        scheduled_for: scheduledFor.toISOString(),
      };
      jobs.push({
        dedupeKey:
          source.type === "booking"
            ? jobKeys.bookingAutomation(source.id, automation.id)
            : jobKeys.eventAutomation(source.id, automation.id),
        kind: "automation_run",
        userId: automation.userId,
        runAt,
        scheduledFor,
        payload: { ...payload },
        // 通知を二重に送らないよう、オートメーションは再試行しない(アクションの失敗は履歴に残す)
        maxAttempts: 1,
      });
    }
  }
  return jobs;
}

/** 毎日のオートメーションの、次の 1 回 */
export function desiredDailyJobs(automations: PlannableAutomation[], timeZone: string, now: Date): DesiredJob[] {
  const jobs: DesiredJob[] = [];
  for (const automation of automations) {
    if (automation.trigger.type !== "daily") continue;
    const next = nextDailyOccurrence(automation.trigger, timeZone, now);
    if (!next) continue;
    const payload: AutomationJobPayload = {
      automation_id: automation.id,
      source_type: "schedule",
      source_id: null,
      scheduled_for: next.runAt.toISOString(),
    };
    jobs.push({
      dedupeKey: jobKeys.daily(automation.id, next.localDate),
      kind: "automation_run",
      userId: automation.userId,
      runAt: next.runAt,
      scheduledFor: next.runAt,
      payload: { ...payload },
      maxAttempts: 1,
    });
  }
  return jobs;
}

export type ExistingJob = Pick<ScheduledJobRow, "id" | "dedupe_key" | "status" | "run_at" | "payload">;

export interface JobPlan {
  /** 新しく入れる */
  insert: DesiredJob[];
  /** 既存の行を、待機中に戻して内容を入れ替える */
  reset: Array<{ id: string; previousStatus: ExistingJob["status"]; job: DesiredJob }>;
  /** 要らなくなった待機中のジョブ */
  cancel: string[];
}

function scheduledForOf(job: ExistingJob): number | null {
  const payload = job.payload;
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>).scheduled_for;
    if (typeof value === "string") {
      const time = Date.parse(value);
      if (!Number.isNaN(time)) return time;
    }
  }
  return null;
}

/**
 * 入れるべきジョブ(desired)と、いまのジョブ(existing)の差分。
 * - 無い → 入れる
 * - 待機中 → 時刻が変わっていれば入れ替える
 * - 実行中 → 触らない
 * - 済み・失敗 → 同じ回(本来の時刻が同じ)なら触らない。違う回なら入れ直す
 * - 取り消し済み → 入れ直す
 * existing のうち desired に無い待機中のものは取り消す。existing には、取り消してよい範囲の行だけを渡すこと。
 */
export function planJobChanges(desired: DesiredJob[], existing: ExistingJob[]): JobPlan {
  const byKey = new Map<string, ExistingJob>();
  for (const job of existing) if (job.dedupe_key) byKey.set(job.dedupe_key, job);

  const plan: JobPlan = { insert: [], reset: [], cancel: [] };
  const wanted = new Set<string>();

  for (const job of desired) {
    wanted.add(job.dedupeKey);
    const current = byKey.get(job.dedupeKey);
    if (!current) {
      plan.insert.push(job);
      continue;
    }
    const sameOccurrence = scheduledForOf(current) === job.scheduledFor.getTime();
    switch (current.status) {
      case "running":
        break;
      case "pending":
        if (!sameOccurrence || Date.parse(current.run_at) !== job.runAt.getTime()) {
          plan.reset.push({ id: current.id, previousStatus: current.status, job });
        }
        break;
      case "done":
      case "failed":
        if (!sameOccurrence) plan.reset.push({ id: current.id, previousStatus: current.status, job });
        break;
      case "cancelled":
        plan.reset.push({ id: current.id, previousStatus: current.status, job });
        break;
    }
  }

  for (const job of existing) {
    if (job.status === "pending" && job.dedupe_key && !wanted.has(job.dedupe_key)) plan.cancel.push(job.id);
  }
  return plan;
}
