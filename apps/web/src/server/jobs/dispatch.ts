import "server-only";
import { z } from "zod";
import type { ScheduledJobRow } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { runScheduledAutomation } from "@/server/automations";
import { syncConnection } from "@/server/calendar";
import { sendBookingEmail } from "@/server/email";
import { NotImplementedError } from "@/server/not-implemented";
import { sendPush, sendSyncPush } from "@/server/push";
import { rescheduleUserAutomations, scheduleNextDaily } from "./index";
import { finishJob } from "./store";
import { nextRetryAt } from "./timing";

/**
 * 時刻が来たジョブの実行(/api/internal/dispatch から呼ぶ)。
 * claim_due_jobs で取り出し(同時に呼ばれても同じジョブは 1 回だけ)、種類ごとに実行して結果を記録する。
 * 失敗は間隔を広げて再試行し、max_attempts に達したら failed にする。
 */

/** 再試行しても直らない失敗 */
export class PermanentJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentJobError";
  }
}

export interface DispatchSummary {
  recovered: number;
  claimed: number;
  done: number;
  retried: number;
  failed: number;
  durationMs: number;
}

/** 実行中のまま、この時間を過ぎたジョブは止まったとみなす */
const STALE_RUNNING_MS = 10 * 60_000;
const BATCH_SIZE = 20;
const CONCURRENCY = 4;

const reminderPayload = z.object({ booking_id: z.uuid(), minutes: z.number(), starts_at: z.string() });
const syncPayload = z.object({ sync: z.literal(true), reason: z.string().default("update") });
const pushPayload = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  alarm: z.boolean().optional(),
});
const reschedulePayload = z.object({ mode: z.literal("reschedule") });
const automationPayload = z.object({
  automation_id: z.uuid(),
  source_type: z.enum(["booking", "external_event", "schedule"]),
  source_id: z.uuid().nullable(),
  scheduled_for: z.string(),
  trigger_event: z.enum(["booking_created", "booking_cancelled"]).optional(),
});
const calendarSyncPayload = z.object({ connection_id: z.uuid() });

function parse<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw new PermanentJobError("ジョブの内容の形が正しくありません");
  return result.data;
}

function requireUser(job: ScheduledJobRow): string {
  if (!job.user_id) throw new PermanentJobError("ジョブにユーザーがありません");
  return job.user_id;
}

/** ジョブ 1 件の実行。結果の要約を返す(ログ用) */
async function runJob(job: ScheduledJobRow): Promise<string> {
  switch (job.kind) {
    case "reminder_email": {
      const payload = parse(reminderPayload, job.payload);
      const { data: booking } = await createAdminClient()
        .from("bookings")
        .select("status, starts_at")
        .eq("id", payload.booking_id)
        .maybeSingle();
      // 実行の直前に、予約がまだ有効で、時刻が変わっていないかを確かめる
      if (!booking || booking.status !== "confirmed") return "予約が確定していないため送りません";
      if (Date.parse(booking.starts_at) !== Date.parse(payload.starts_at)) return "予約の時刻が変わったため送りません";
      await sendBookingEmail("booking_reminder", payload.booking_id);
      return "リマインドを送りました";
    }

    case "push_notification": {
      const userId = requireUser(job);
      const sync = syncPayload.safeParse(job.payload);
      const result = sync.success
        ? await sendSyncPush(userId, sync.data.reason)
        : await sendPush(userId, parse(pushPayload, job.payload));
      return result.skipped ? `送りません(${result.skipped})` : `${result.sent} 台に送りました`;
    }

    case "automation_run": {
      if (reschedulePayload.safeParse(job.payload).success) {
        const result = await rescheduleUserAutomations(requireUser(job));
        return `入れ直し: 追加 ${result.inserted}、変更 ${result.reset}、取り消し ${result.cancelled}`;
      }
      const payload = parse(automationPayload, job.payload);
      const outcome = await runScheduledAutomation(
        payload.trigger_event ? { ...payload, trigger_event: payload.trigger_event } : payload,
      );
      if (payload.source_type === "schedule") await scheduleNextDaily(payload.automation_id);
      return outcome.outcome === "ran" ? `実行しました(${outcome.run.status})` : `実行しません: ${outcome.reason}`;
    }

    case "calendar_sync": {
      const payload = parse(calendarSyncPayload, job.payload);
      const result = await syncConnection(payload.connection_id);
      return `同期: 追加 ${result.added}、更新 ${result.updated}、削除 ${result.removed}`;
    }

    case "calendar_watch_renew":
      // 実行先の入口がまだ無い(@/server/calendar に用意してもらう)
      throw new PermanentJobError("calendar_watch_renew の実行先がありません");
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return message.slice(0, 500);
}

async function processJob(job: ScheduledJobRow, summary: DispatchSummary): Promise<void> {
  try {
    const note = await runJob(job);
    await finishJob(job, { status: "done" });
    summary.done++;
    console.info(`[jobs] ${job.kind} ${job.id}: ${note}`);
  } catch (error) {
    const permanent = error instanceof PermanentJobError || error instanceof NotImplementedError;
    const message = errorMessage(error);
    if (permanent || job.attempts >= job.max_attempts) {
      await finishJob(job, { status: "failed", lastError: message });
      summary.failed++;
      console.error(`[jobs] ${job.kind} ${job.id} が失敗しました: ${message}`);
    } else {
      await finishJob(job, { status: "pending", lastError: message, runAt: nextRetryAt(job.attempts, new Date()) });
      summary.retried++;
      console.warn(`[jobs] ${job.kind} ${job.id} を再試行します(${job.attempts}/${job.max_attempts}): ${message}`);
    }
  }
}

/** 実行中のまま止まったジョブ(処理中に関数が落ちたなど)を、もう一度取り出せるようにする */
async function recoverStaleJobs(now: Date): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("scheduled_jobs")
    .select("*")
    .eq("status", "running")
    .lt("locked_at", new Date(now.getTime() - STALE_RUNNING_MS).toISOString())
    .limit(100);
  if (error) throw new Error(`scheduled_jobs を読めません: ${error.message}`);
  for (const job of data ?? []) {
    await finishJob(
      job,
      job.attempts >= job.max_attempts
        ? { status: "failed", lastError: "実行中に止まりました" }
        : { status: "pending", lastError: "実行中に止まったため再試行します", runAt: now },
    );
  }
  return data?.length ?? 0;
}

async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) await worker(items[next++]!);
  });
  await Promise.all(lanes);
}

/** 時刻が来たジョブを、時間の許す範囲で実行する。残りは次の呼び出しに回す */
export async function dispatchDueJobs(options: { timeBudgetMs?: number } = {}): Promise<DispatchSummary> {
  const started = Date.now();
  const budget = options.timeBudgetMs ?? 40_000;
  const summary: DispatchSummary = { recovered: 0, claimed: 0, done: 0, retried: 0, failed: 0, durationMs: 0 };

  summary.recovered = await recoverStaleJobs(new Date());

  while (Date.now() - started < budget) {
    const { data: jobs, error } = await createAdminClient().rpc("claim_due_jobs", { p_limit: BATCH_SIZE });
    if (error) throw new Error(`ジョブを取り出せません: ${error.message}`);
    if (!jobs || jobs.length === 0) break;
    summary.claimed += jobs.length;
    await runPool(jobs, CONCURRENCY, (job) => processJob(job, summary));
    if (jobs.length < BATCH_SIZE) break;
  }

  summary.durationMs = Date.now() - started;
  return summary;
}
