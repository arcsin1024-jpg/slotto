import "server-only";
import { z } from "zod";
import type { AutomationActionResult } from "@slotto/core";
import type { AutomationRunRow, Json } from "@slotto/core/database";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AutomationJobPayload } from "@/server/jobs/plan";
import {
  computeTriggerTime,
  isStillDue,
  isTimedTrigger,
  localDayRange,
  matchesTarget,
} from "@/server/jobs/timing";
import { executeAction } from "./actions";
import {
  loadAgenda,
  loadAutomation,
  loadBooking,
  loadExternalEvent,
  loadSourceDetails,
  loadUserTimezone,
  parseAutomation,
  toScheduleSource,
  type ParsedAutomation,
} from "./sources";
import { buildTemplateVariables, type EventDetails } from "./template";

/**
 * オートメーションの実行と、実行履歴(automation_runs)の記録(担当: S4 実行基盤)。
 * 時刻が来たジョブからは runScheduledAutomation、試し実行の API からは runAutomationTest を呼ぶ。
 */

/** 予約が入った・キャンセルされたときのジョブの payload */
export interface BookingTriggerJobPayload extends AutomationJobPayload {
  trigger_event: "booking_created" | "booking_cancelled";
}

export type AutomationOutcome =
  | { outcome: "ran"; run: AutomationRunRow }
  | { outcome: "skipped"; reason: string };

const skipped = (reason: string): AutomationOutcome => ({ outcome: "skipped", reason });

function overallStatus(results: AutomationActionResult[]): AutomationRunRow["status"] {
  if (results.some((r) => r.status === "failed")) return "failed";
  if (results.length > 0 && results.every((r) => r.status === "skipped")) return "skipped";
  return "success";
}

async function executeAutomation(input: {
  automation: ParsedAutomation;
  event: EventDetails | null;
  agenda: EventDetails[] | null;
  agendaDate: Date | null;
  sourceType: AutomationRunRow["source_type"];
  sourceId: string | null;
  scheduledFor: Date;
  test: boolean;
}): Promise<AutomationRunRow> {
  const { automation } = input;
  const userId = automation.row.user_id;
  const admin = createAdminClient();
  const timeZone = await loadUserTimezone(userId);

  const { data: run, error } = await admin
    .from("automation_runs")
    .insert({
      automation_id: automation.row.id,
      user_id: userId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      scheduled_for: input.scheduledFor.toISOString(),
      started_at: new Date().toISOString(),
      status: "running",
    })
    .select("*")
    .single();
  if (error || !run) throw new Error(`automation_runs に記録できません: ${error?.message}`);

  const variables = buildTemplateVariables(
    input.event,
    timeZone,
    input.agenda && input.agendaDate ? { date: input.agendaDate, events: input.agenda } : null,
  );
  const ctx = {
    userId,
    automation: { id: automation.row.id, name: automation.row.name, trigger: automation.trigger },
    event: input.event,
    agenda: input.agenda,
    variables,
    runId: run.id,
    idempotencyKey: input.test
      ? `test:${run.id}`
      : `${automation.row.id}:${input.sourceType}:${input.sourceId ?? "-"}:${input.scheduledFor.toISOString()}`,
    test: input.test,
  };

  // 前のアクションの結果に関わらず、順に全部実行する
  const results: AutomationActionResult[] = [];
  for (const [index, action] of automation.actions.entries()) {
    results.push(await executeAction(action, index, ctx));
  }

  const status = overallStatus(results);
  const { data: finished, error: updateError } = await admin
    .from("automation_runs")
    .update({
      status,
      results: results as unknown as Json,
      error: results.find((r) => r.status === "failed")?.error ?? null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .select("*")
    .single();
  if (updateError || !finished) throw new Error(`automation_runs を更新できません: ${updateError?.message}`);
  return finished;
}

/** 同じ回の実行が、すでに記録されているか(二重に動かさない) */
async function alreadyRan(automationId: string, sourceType: AutomationRunRow["source_type"], sourceId: string | null, scheduledFor: Date) {
  let query = createAdminClient()
    .from("automation_runs")
    .select("id, status")
    .eq("automation_id", automationId)
    .eq("source_type", sourceType)
    .eq("scheduled_for", scheduledFor.toISOString());
  query = sourceId ? query.eq("source_id", sourceId) : query.is("source_id", null);
  const { data, error } = await query.limit(1);
  if (error) throw new Error(`automation_runs を読めません: ${error.message}`);
  return (data ?? []).length > 0;
}

/** 時刻が来たオートメーションのジョブを実行する。実行の直前に、まだ動かしてよいかを確かめる */
export async function runScheduledAutomation(
  payload: AutomationJobPayload | BookingTriggerJobPayload,
  now: Date = new Date(),
): Promise<AutomationOutcome> {
  const row = await loadAutomation(payload.automation_id);
  if (!row) return skipped("オートメーションが削除されています");
  if (!row.is_enabled) return skipped("オートメーションがオフです");
  const automation = parseAutomation(row);
  if (!automation) return skipped("オートメーションの設定の形が正しくありません");
  const scheduledFor = new Date(payload.scheduled_for);
  const { trigger, target } = automation;

  let event: EventDetails | null = null;
  let agenda: EventDetails[] | null = null;
  let agendaDate: Date | null = null;

  if ("trigger_event" in payload) {
    // 予約が入った・キャンセルされたとき
    if (trigger.type !== payload.trigger_event) return skipped("トリガーが変わっています");
    const booking = payload.source_id ? await loadBooking(payload.source_id) : null;
    if (!booking || booking.row.host_id !== row.user_id) return skipped("予約が見つかりません");
    const expected = payload.trigger_event === "booking_created" ? ["pending", "confirmed"] : ["cancelled", "declined"];
    if (!expected.includes(booking.row.status)) return skipped("予約の状態が変わっています");
    if (!matchesTarget(target, toScheduleSource(booking.details))) return skipped("対象から外れています");
    event = booking.details;
  } else if (payload.source_type === "schedule") {
    // 毎日決まった時刻
    if (trigger.type !== "daily") return skipped("トリガーが変わっています");
    if (!isStillDue(trigger, scheduledFor, null, now)) return skipped("実行の時刻を過ぎています");
    const timeZone = await loadUserTimezone(row.user_id);
    agendaDate = scheduledFor;
    agenda = await loadAgenda(row.user_id, target, localDayRange(scheduledFor, timeZone));
  } else {
    // 予定の時刻に合わせて動くもの
    if (!isTimedTrigger(trigger)) return skipped("トリガーが変わっています");
    if (!payload.source_id) return skipped("対象の予定がありません");
    if (payload.source_type === "booking") {
      const booking = await loadBooking(payload.source_id);
      if (!booking || booking.row.host_id !== row.user_id) return skipped("予約が見つかりません");
      if (booking.row.status !== "confirmed") return skipped("予約が確定していません");
      event = booking.details;
    } else {
      const external = await loadExternalEvent(payload.source_id);
      if (!external || external.row.user_id !== row.user_id) return skipped("予定が見つかりません");
      if (!external.row.is_selected) return skipped("予定の反映が解除されています");
      event = external.details;
    }
    const source = toScheduleSource(event);
    if (!matchesTarget(target, source)) return skipped("対象から外れています");
    if (computeTriggerTime(trigger, source).getTime() !== scheduledFor.getTime()) return skipped("予定の時刻が変わっています");
    if (!isStillDue(trigger, scheduledFor, source, now)) return skipped("実行の時刻を過ぎています");
  }

  const sourceType = payload.source_type;
  if (await alreadyRan(row.id, sourceType, payload.source_id, scheduledFor)) return skipped("この回はすでに実行しています");

  const run = await executeAutomation({
    automation,
    event,
    agenda,
    agendaDate,
    sourceType,
    sourceId: payload.source_id,
    scheduledFor,
    test: false,
  });
  return { outcome: "ran", run };
}

export class AutomationTestError extends Error {
  constructor(
    readonly code: "not_found" | "invalid" | "too_many",
    message: string,
  ) {
    super(message);
    this.name = "AutomationTestError";
  }
}

/** 対象になる予定が無いときに使う、見本の予定 */
function sampleEvent(now: Date): EventDetails {
  const start = new Date(Math.ceil((now.getTime() + 60 * 60_000) / (30 * 60_000)) * 30 * 60_000);
  return {
    source_type: "booking",
    id: "sample",
    title: "サンプルの予定(試し実行)",
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + 30 * 60_000).toISOString(),
    is_all_day: false,
    location: "オンライン",
    meeting_url: "https://example.com/meeting",
    guest_name: "見本 太郎",
    guest_email: "guest@example.com",
    answers: [{ label: "ご相談内容", value: "試し実行のための見本です" }],
    booking_page_id: null,
  };
}

const TEST_INTERVAL_MS = 10_000;
const UUID = z.uuid();

/**
 * 試し実行。オフのオートメーションでも動かす。対象に当たる直近の予定(無ければ見本の予定)で、すべてのアクションを実際に実行する。
 * 履歴には source_type: "manual" で残す。
 */
export async function runAutomationTest(userId: string, automationId: string, now: Date = new Date()): Promise<AutomationRunRow> {
  const row = UUID.safeParse(automationId).success ? await loadAutomation(automationId) : null;
  if (!row || row.user_id !== userId) throw new AutomationTestError("not_found", "オートメーションが見つかりません");
  const automation = parseAutomation(row);
  if (!automation) throw new AutomationTestError("invalid", "オートメーションの設定の形が正しくありません");

  // 連打で外部に送り続けないよう、間隔を空ける
  const { data: recent } = await createAdminClient()
    .from("automation_runs")
    .select("id")
    .eq("automation_id", automationId)
    .eq("source_type", "manual")
    .gte("created_at", new Date(now.getTime() - TEST_INTERVAL_MS).toISOString())
    .limit(1);
  if ((recent ?? []).length > 0) throw new AutomationTestError("too_many", "少し時間をおいてから試してください");

  const { trigger, target } = automation;
  let event: EventDetails | null = null;
  let agenda: EventDetails[] | null = null;
  let agendaDate: Date | null = null;

  if (trigger.type === "daily") {
    const timeZone = await loadUserTimezone(userId);
    agendaDate = now;
    agenda = await loadAgenda(userId, target, localDayRange(now, timeZone));
  } else {
    const bookingOnly = trigger.type === "booking_created" || trigger.type === "booking_cancelled";
    const upcoming = await loadSourceDetails(userId, { from: now, to: new Date(now.getTime() + 60 * 24 * 60 * 60_000), now });
    event =
      upcoming.find((e) => {
        const source = toScheduleSource(e);
        return (!bookingOnly || source.type === "booking") && (!isTimedTrigger(trigger) || !source.isAllDay) && matchesTarget(target, source);
      }) ?? sampleEvent(now);
  }

  return executeAutomation({
    automation,
    event,
    agenda,
    agendaDate,
    sourceType: "manual",
    sourceId: event && event.id !== "sample" ? event.id : null,
    scheduledFor: now,
    test: true,
  });
}
