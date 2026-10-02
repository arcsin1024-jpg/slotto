import type { FormField } from "@slotto/core";
import type { BookingPageRow } from "@slotto/core/database";
import { describe, expect, it } from "vitest";
import { guestChangeState, isValidTimeZone, parseFormFields, toSlotPageConfig, validateAnswers } from "./rules";

const fields: FormField[] = [
  { id: "company", type: "text", label: "会社名", required: true },
  { id: "topic", type: "textarea", label: "ご相談内容", required: false },
  { id: "plan", type: "select", label: "プラン", required: false, options: ["無料", "有料"] },
  { id: "agree", type: "checkbox", label: "規約に同意する", required: true },
  { id: "tel", type: "phone", label: "電話番号", required: false },
];

describe("validateAnswers", () => {
  it("質問に無いキーを捨て、文字列の前後の空白を取る", () => {
    const result = validateAnswers(fields, { company: "  株式会社ミライ ", agree: true, extra: "x" });
    expect(result).toEqual({ ok: true, answers: { company: "株式会社ミライ", agree: true } });
  });

  it("必須の未回答を受け付けない(空白だけ、チェックなしも未回答)", () => {
    expect(validateAnswers(fields, { company: "  ", agree: true })).toMatchObject({ ok: false });
    expect(validateAnswers(fields, { company: "A", agree: false })).toEqual({
      ok: false,
      message: "「規約に同意する」を入力してください",
    });
  });

  it("選択肢に無い値を受け付けない", () => {
    expect(validateAnswers(fields, { company: "A", agree: true, plan: "特別" })).toMatchObject({ ok: false });
    expect(validateAnswers(fields, { company: "A", agree: true, plan: "有料" })).toMatchObject({ ok: true });
  });

  it("型が違う値を受け付けない", () => {
    expect(validateAnswers(fields, { company: true, agree: true })).toMatchObject({ ok: false });
    expect(validateAnswers(fields, { company: "A", agree: "yes" })).toMatchObject({ ok: false });
  });

  it("電話番号の形を確かめる", () => {
    expect(validateAnswers(fields, { company: "A", agree: true, tel: "03-1234-5678" })).toMatchObject({ ok: true });
    expect(validateAnswers(fields, { company: "A", agree: true, tel: "電話して" })).toMatchObject({ ok: false });
  });
});

describe("parseFormFields", () => {
  it("壊れた値は質問なしとして扱う", () => {
    expect(parseFormFields({ foo: 1 })).toEqual([]);
    expect(parseFormFields(null)).toEqual([]);
    expect(parseFormFields([{ id: "a", type: "text", label: "名前" }])).toHaveLength(1);
  });
});

const page = {
  allow_guest_cancel: true,
  allow_guest_reschedule: true,
  guest_change_deadline_minutes: 60,
  is_active: true,
  kind: "recurring" as const,
};
const booking = { status: "confirmed" as const, starts_at: "2026-10-05T01:00:00.000Z" };

describe("guestChangeState", () => {
  it("期限(開始の N 分前)より前なら変更・キャンセルできる", () => {
    const state = guestChangeState(booking, page, new Date("2026-10-04T23:59:59.000Z"));
    expect(state).toEqual({
      canCancel: true,
      canReschedule: true,
      deadline: new Date("2026-10-05T00:00:00.000Z"),
      isPastDeadline: false,
    });
  });

  it("期限ちょうどからはできない", () => {
    const state = guestChangeState(booking, page, new Date("2026-10-05T00:00:00.000Z"));
    expect(state.isPastDeadline).toBe(true);
    expect(state.canCancel).toBe(false);
    expect(state.canReschedule).toBe(false);
  });

  it("期限が 0 分なら開始時刻まで", () => {
    const state = guestChangeState(booking, { ...page, guest_change_deadline_minutes: 0 }, new Date("2026-10-05T00:59:00.000Z"));
    expect(state.canCancel).toBe(true);
  });

  it("予約ページの設定で許していなければできない", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    expect(guestChangeState(booking, { ...page, allow_guest_cancel: false }, now).canCancel).toBe(false);
    expect(guestChangeState(booking, { ...page, allow_guest_reschedule: false }, now).canReschedule).toBe(false);
  });

  it("予約ページが消えていればキャンセルだけできる", () => {
    const state = guestChangeState(booking, null, new Date("2026-10-01T00:00:00.000Z"));
    expect(state.canCancel).toBe(true);
    expect(state.canReschedule).toBe(false);
  });

  it("受付停止中は日程変更できない。ただし 1 回限りの予約ページはできる", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    expect(guestChangeState(booking, { ...page, is_active: false }, now).canReschedule).toBe(false);
    expect(guestChangeState(booking, { ...page, is_active: false, kind: "one_time" }, now).canReschedule).toBe(true);
  });

  it("キャンセル済み・辞退済みの予約は何もできない", () => {
    const now = new Date("2026-10-01T00:00:00.000Z");
    for (const status of ["cancelled", "declined"] as const) {
      const state = guestChangeState({ ...booking, status }, page, now);
      expect(state.canCancel || state.canReschedule).toBe(false);
      expect(state.deadline).toBeNull();
    }
  });
});

describe("toSlotPageConfig", () => {
  it("受付時間が壊れていれば受け付けない扱いにする", () => {
    const row = { availability: { weekly: "壊れた値" }, timezone: "Asia/Tokyo" } as unknown as BookingPageRow;
    expect(toSlotPageConfig(row).availability.weekly["1"]).toEqual([]);
  });
});

describe("isValidTimeZone", () => {
  it("IANA の名前だけを通す", () => {
    expect(isValidTimeZone("Asia/Tokyo")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
  });
});
