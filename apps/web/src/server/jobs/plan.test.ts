import { describe, expect, it } from "vitest";
import { isPlannedAutomationKey, jobKeys, likePrefix } from "./keys";
import {
  desiredDailyJobs,
  desiredReminderJobs,
  desiredTimedAutomationJobs,
  planJobChanges,
  type ExistingJob,
  type PlannableAutomation,
} from "./plan";
import type { ScheduleSource } from "./timing";

const at = (iso: string) => new Date(iso);
const now = at("2026-10-05T00:00:00Z");

const booking: ScheduleSource = {
  type: "booking",
  id: "b1",
  bookingPageId: "p1",
  startsAt: at("2026-10-06T01:00:00Z"),
  endsAt: at("2026-10-06T01:30:00Z"),
  isAllDay: false,
};
const external: ScheduleSource = {
  type: "external_event",
  id: "e1",
  bookingPageId: null,
  startsAt: at("2026-10-06T05:00:00Z"),
  endsAt: at("2026-10-06T06:00:00Z"),
  isAllDay: false,
};
const allDay: ScheduleSource = { ...external, id: "e2", isAllDay: true };

const automation = (id: string, trigger: PlannableAutomation["trigger"], target: PlannableAutomation["target"] = { scope: "all" }) => ({
  id,
  userId: "u1",
  trigger,
  target,
});

describe("desiredReminderJobs", () => {
  it("リマインドの分ごとに 1 件。過ぎたものは入れない", () => {
    const jobs = desiredReminderJobs({ id: "b1", hostId: "u1", startsAt: booking.startsAt }, [1440, 60, 60, 2880], now);
    expect(jobs.map((j) => j.dedupeKey)).toEqual(["booking:b1:reminder:1440", "booking:b1:reminder:60"]);
    expect(jobs[0]!.runAt.toISOString()).toBe("2026-10-05T01:00:00.000Z");
    expect(jobs[0]!.payload).toMatchObject({ booking_id: "b1", minutes: 1440, starts_at: "2026-10-06T01:00:00.000Z" });
  });
});

describe("desiredTimedAutomationJobs", () => {
  it("対象に当たる予定ごとに 1 件。終日の予定は除く", () => {
    const jobs = desiredTimedAutomationJobs(
      [
        automation("a1", { type: "before_start", offset_minutes: 10 }),
        automation("a2", { type: "at_start" }, { scope: "bookings" }),
        automation("a3", { type: "booking_created" }),
      ],
      [booking, external, allDay],
      now,
    );
    expect(jobs.map((j) => j.dedupeKey)).toEqual([
      "booking:b1:automation:a1",
      "event:e1:automation:a1",
      "booking:b1:automation:a2",
    ]);
    expect(jobs[0]).toMatchObject({ kind: "automation_run", maxAttempts: 1 });
    expect(jobs[0]!.payload).toEqual({
      automation_id: "a1",
      source_type: "booking",
      source_id: "b1",
      scheduled_for: "2026-10-06T00:50:00.000Z",
    });
  });
  it("終わった予定には入れない", () => {
    const past = { ...booking, startsAt: at("2026-10-01T00:00:00Z"), endsAt: at("2026-10-01T01:00:00Z") };
    expect(desiredTimedAutomationJobs([automation("a1", { type: "after_end", offset_minutes: 0 })], [past], now)).toEqual([]);
  });
});

describe("desiredDailyJobs", () => {
  it("次の 1 回を、ホストの日付付きのキーで入れる", () => {
    const jobs = desiredDailyJobs(
      [automation("a1", { type: "daily", time: "09:30", weekdays: [1] }), automation("a2", { type: "at_start" })],
      "Asia/Tokyo",
      now, // 東京の月曜 09:00
    );
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.dedupeKey).toBe("automation:a1:daily:2026-10-05");
    expect(jobs[0]!.runAt.toISOString()).toBe("2026-10-05T00:30:00.000Z");
    expect(jobs[0]!.payload).toMatchObject({ source_type: "schedule", source_id: null });
  });
});

describe("planJobChanges", () => {
  const desired = desiredTimedAutomationJobs([automation("a1", { type: "before_start", offset_minutes: 10 })], [booking], now);
  const job = desired[0]!;
  const existing = (status: ExistingJob["status"], scheduledFor = job.scheduledFor, runAt = job.runAt): ExistingJob => ({
    id: "j1",
    dedupe_key: job.dedupeKey,
    status,
    run_at: runAt.toISOString(),
    payload: { ...job.payload, scheduled_for: scheduledFor.toISOString() },
  });

  it("無ければ入れる", () => {
    expect(planJobChanges(desired, [])).toEqual({ insert: desired, reset: [], cancel: [] });
  });
  it("待機中で同じなら何もしない。時刻が変わったら入れ替える", () => {
    expect(planJobChanges(desired, [existing("pending")])).toEqual({ insert: [], reset: [], cancel: [] });
    const moved = planJobChanges(desired, [existing("pending", at("2026-10-06T00:00:00Z"), at("2026-10-06T00:00:00Z"))]);
    expect(moved.reset).toEqual([{ id: "j1", previousStatus: "pending", job }]);
  });
  it("実行中は触らない", () => {
    expect(planJobChanges(desired, [existing("running")])).toEqual({ insert: [], reset: [], cancel: [] });
  });
  it("済みの同じ回は入れ直さない(二重に動かさない)。別の回なら入れ直す", () => {
    expect(planJobChanges(desired, [existing("done")])).toEqual({ insert: [], reset: [], cancel: [] });
    expect(planJobChanges(desired, [existing("failed")])).toEqual({ insert: [], reset: [], cancel: [] });
    expect(planJobChanges(desired, [existing("done", at("2026-09-01T00:00:00Z"))]).reset).toHaveLength(1);
  });
  it("取り消し済みは入れ直す", () => {
    expect(planJobChanges(desired, [existing("cancelled")]).reset).toHaveLength(1);
  });
  it("要らなくなった待機中のものは取り消す", () => {
    const stale: ExistingJob = { ...existing("pending"), id: "j2", dedupe_key: "booking:b1:automation:old" };
    const doneStale: ExistingJob = { ...existing("done"), id: "j3", dedupe_key: "booking:b1:automation:older" };
    expect(planJobChanges(desired, [existing("pending"), stale, doneStale]).cancel).toEqual(["j2"]);
  });
});

describe("keys", () => {
  it("ユーザー単位の入れ直しで扱うキー", () => {
    expect(isPlannedAutomationKey(jobKeys.bookingAutomation("b1", "a1"))).toBe(true);
    expect(isPlannedAutomationKey(jobKeys.eventAutomation("e1", "a1"))).toBe(true);
    expect(isPlannedAutomationKey(jobKeys.daily("a1", "2026-10-05"))).toBe(true);
    expect(isPlannedAutomationKey(jobKeys.bookingReminder("b1", 60))).toBe(false);
    expect(isPlannedAutomationKey(jobKeys.bookingTrigger("b1", "created", "a1"))).toBe(false);
    expect(isPlannedAutomationKey(jobKeys.userReschedule("u1"))).toBe(false);
  });
  it("LIKE の前方一致を逃がす", () => {
    expect(likePrefix("booking:a_b%:")).toBe("booking:a\\_b\\%:%");
  });
});
