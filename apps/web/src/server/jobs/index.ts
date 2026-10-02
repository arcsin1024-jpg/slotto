import "server-only";
import type { ScheduledJobKind } from "@slotto/core/database";
import { NotImplementedError } from "@/server/not-implemented";

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
  void input;
  throw new NotImplementedError("enqueueJob", "S4");
}

/** dedupe_key が prefix で始まる、未実行のジョブを取り消す */
export async function cancelJobs(dedupeKeyPrefix: string): Promise<void> {
  void dedupeKeyPrefix;
  throw new NotImplementedError("cancelJobs", "S4");
}

/**
 * 予約に関するジョブ(メールのリマインド、通知・アラーム、オートメーション)をまとめて入れ直す。
 * 予約の確定・承認・日程変更のあとに呼ぶ。
 */
export async function scheduleBookingJobs(bookingId: string): Promise<void> {
  void bookingId;
  throw new NotImplementedError("scheduleBookingJobs", "S4");
}

/** 予約に関するジョブをまとめて取り消す。キャンセル・辞退のあとに呼ぶ */
export async function cancelBookingJobs(bookingId: string): Promise<void> {
  void bookingId;
  throw new NotImplementedError("cancelBookingJobs", "S4");
}

/** 予約が入った・キャンセルされたときに動くオートメーションを実行する */
export async function triggerBookingAutomations(
  event: "booking_created" | "booking_cancelled",
  bookingId: string,
): Promise<void> {
  void event; void bookingId;
  throw new NotImplementedError("triggerBookingAutomations", "S4");
}
