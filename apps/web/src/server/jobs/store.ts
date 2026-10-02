import "server-only";
import type { Json, ScheduledJobRow, TablesInsert } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import { likePrefix } from "./keys";
import { planJobChanges, type DesiredJob, type ExistingJob } from "./plan";

/** scheduled_jobs の読み書き。サーバー専用の表なので、すべて service_role で触る */

export const toJson = (value: Record<string, unknown>) => value as unknown as Json;

const EXISTING_COLUMNS = "id, dedupe_key, status, run_at, payload";

function rowOf(job: DesiredJob): TablesInsert<"scheduled_jobs"> {
  return {
    user_id: job.userId,
    kind: job.kind,
    run_at: job.runAt.toISOString(),
    payload: toJson(job.payload),
    dedupe_key: job.dedupeKey,
    max_attempts: job.maxAttempts,
    status: "pending",
    attempts: 0,
    last_error: null,
    locked_at: null,
    finished_at: null,
  };
}

/** dedupe_key が一致する行(100 件ずつ) */
export async function findJobsByKeys(keys: string[]): Promise<ExistingJob[]> {
  const admin = createAdminClient();
  const result: ExistingJob[] = [];
  for (let i = 0; i < keys.length; i += 100) {
    const { data, error } = await admin.from("scheduled_jobs").select(EXISTING_COLUMNS).in("dedupe_key", keys.slice(i, i + 100));
    if (error) throw new Error(`scheduled_jobs を読めません: ${error.message}`);
    result.push(...(data ?? []));
  }
  return result;
}

/** dedupe_key が prefix で始まる行 */
export async function findJobsByPrefix(prefix: string): Promise<ExistingJob[]> {
  const { data, error } = await createAdminClient()
    .from("scheduled_jobs")
    .select(EXISTING_COLUMNS)
    .like("dedupe_key", likePrefix(prefix))
    .limit(1000);
  if (error) throw new Error(`scheduled_jobs を読めません: ${error.message}`);
  return data ?? [];
}

/**
 * 入れるべきジョブ(desired)に合わせて、scope の範囲のジョブを入れ直す。
 * scope にある待機中のジョブのうち、desired に無いものは取り消す。
 */
export async function syncJobs(desired: DesiredJob[], scope: ExistingJob[]): Promise<{ inserted: number; reset: number; cancelled: number }> {
  const scopeIds = new Set(scope.map((j) => j.id));
  const keyed = (await findJobsByKeys(desired.map((j) => j.dedupeKey))).filter((j) => !scopeIds.has(j.id));
  const plan = planJobChanges(desired, [...scope, ...keyed]);
  const admin = createAdminClient();

  if (plan.insert.length > 0) {
    // 同時に入れられたときは、後から来た方で上書きする
    const { error } = await admin.from("scheduled_jobs").upsert(plan.insert.map(rowOf), { onConflict: "dedupe_key" });
    if (error) throw new Error(`ジョブを入れられません: ${error.message}`);
  }
  for (const { id, previousStatus, job } of plan.reset) {
    // 読んだあとに状態が変わっていたら(実行が始まったなど)、触らない
    const { error } = await admin.from("scheduled_jobs").update(rowOf(job)).eq("id", id).eq("status", previousStatus);
    if (error) throw new Error(`ジョブを入れ直せません: ${error.message}`);
  }
  if (plan.cancel.length > 0) {
    const { error } = await admin
      .from("scheduled_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .in("id", plan.cancel)
      .eq("status", "pending");
    if (error) throw new Error(`ジョブを取り消せません: ${error.message}`);
  }
  return { inserted: plan.insert.length, reset: plan.reset.length, cancelled: plan.cancel.length };
}

/** 1 件を入れる。同じ dedupe_key があれば上書きして待機中に戻す */
export async function upsertJob(job: DesiredJob): Promise<void> {
  const { error } = await createAdminClient().from("scheduled_jobs").upsert(rowOf(job), { onConflict: "dedupe_key" });
  if (error) throw new Error(`ジョブを入れられません: ${error.message}`);
}

/**
 * まとめて 1 回にしたいジョブ(同期のプッシュなど)。待機中のものがあれば、早い方の時刻に合わせるだけにする。
 * 同じ変更が続いても、実行が先送りされ続けないようにする。
 */
export async function upsertDebouncedJob(job: DesiredJob): Promise<void> {
  const admin = createAdminClient();
  const { data: current, error } = await admin
    .from("scheduled_jobs")
    .select("id, status, run_at")
    .eq("dedupe_key", job.dedupeKey)
    .maybeSingle();
  if (error) throw new Error(`scheduled_jobs を読めません: ${error.message}`);
  if (current?.status === "pending") {
    if (Date.parse(current.run_at) > job.runAt.getTime()) {
      await admin.from("scheduled_jobs").update({ run_at: job.runAt.toISOString() }).eq("id", current.id).eq("status", "pending");
    }
    return;
  }
  await upsertJob(job);
}

/** dedupe_key が prefix で始まる、未実行のジョブを取り消す */
export async function cancelJobsByPrefix(prefix: string): Promise<number> {
  const { data, error } = await createAdminClient()
    .from("scheduled_jobs")
    .update({ status: "cancelled", finished_at: new Date().toISOString() })
    .like("dedupe_key", likePrefix(prefix))
    .eq("status", "pending")
    .select("id");
  if (error) throw new Error(`ジョブを取り消せません: ${error.message}`);
  return data?.length ?? 0;
}

/** 実行が終わったジョブを記録する。取り出したとき(locked_at)のままの行だけを更新する */
export async function finishJob(
  job: ScheduledJobRow,
  update: { status: "done" | "failed" | "pending"; lastError?: string | null; runAt?: Date },
): Promise<void> {
  let query = createAdminClient()
    .from("scheduled_jobs")
    .update({
      status: update.status,
      last_error: update.lastError ?? null,
      finished_at: update.status === "pending" ? null : new Date().toISOString(),
      locked_at: null,
      ...(update.runAt ? { run_at: update.runAt.toISOString() } : {}),
    })
    .eq("id", job.id)
    .eq("status", "running");
  query = job.locked_at ? query.eq("locked_at", job.locked_at) : query.is("locked_at", null);
  const { error } = await query;
  if (error) throw new Error(`ジョブの結果を記録できません: ${error.message}`);
}

/** 無いときだけ入れる(同じ出来事で 2 回呼ばれても、2 回は動かさない) */
export async function insertJobIfAbsent(job: DesiredJob): Promise<void> {
  const { error } = await createAdminClient()
    .from("scheduled_jobs")
    .upsert(rowOf(job), { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error(`ジョブを入れられません: ${error.message}`);
}

/** ユーザーの、待機中のジョブ(種類で絞る) */
export async function findPendingJobsForUser(userId: string, kind: ScheduledJobRow["kind"]): Promise<ExistingJob[]> {
  const { data, error } = await createAdminClient()
    .from("scheduled_jobs")
    .select(EXISTING_COLUMNS)
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("status", "pending")
    .limit(5000);
  if (error) throw new Error(`scheduled_jobs を読めません: ${error.message}`);
  return data ?? [];
}
