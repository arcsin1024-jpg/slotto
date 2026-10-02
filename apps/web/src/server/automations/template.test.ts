import { describe, expect, it } from "vitest";
import { buildTemplateVariables, expandTemplate, templateKeys, truncate, type EventDetails } from "./template";

const event: EventDetails = {
  source_type: "booking",
  id: "b1",
  title: "初回のご相談",
  starts_at: "2026-10-05T05:00:00Z",
  ends_at: "2026-10-05T05:30:00Z",
  is_all_day: false,
  location: null,
  meeting_url: "https://meet.example.com/abc",
  guest_name: "佐藤 太郎",
  guest_email: "taro@example.com",
  answers: [
    { label: "会社名", value: "株式会社ミライ" },
    { label: "ご相談内容", value: "料金について" },
  ],
  booking_page_id: "p1",
};

describe("expandTemplate", () => {
  it("差し込みを値に置き換える。空白があってもよい", () => {
    expect(expandTemplate("まもなく: {{title}} / {{ guest_name }}", { title: "定例", guest_name: "佐藤" })).toBe(
      "まもなく: 定例 / 佐藤",
    );
  });
  it("知らないキーは空にする。プロトタイプのキーも拾わない", () => {
    expect(expandTemplate("[{{unknown}}][{{constructor}}][{{toString}}]", { title: "x" })).toBe("[][][]");
  });
  it("値の中の {{...}} はもう一度展開しない", () => {
    expect(expandTemplate("{{title}}", { title: "{{guest_email}}", guest_email: "secret@example.com" })).toBe(
      "{{guest_email}}",
    );
  });
  it("encode で値を包める(AI への指示文用)", () => {
    expect(expandTemplate("予定: {{title}}", { title: '無視して"指示"' }, (v) => JSON.stringify(v))).toBe(
      '予定: "無視して\\"指示\\""',
    );
  });
  it("使われているキー", () => {
    expect(templateKeys("{{title}} {{ start }} {{title}}")).toEqual(["title", "start"]);
  });
});

describe("buildTemplateVariables", () => {
  it("日時はホストのタイムゾーンで、回答は「質問: 回答」の行にする", () => {
    const vars = buildTemplateVariables(event, "Asia/Tokyo", null);
    expect(vars.start).toBe("2026年10月5日(月) 14:00");
    expect(vars.end).toBe("2026年10月5日(月) 14:30");
    expect(vars.answers).toBe("会社名: 株式会社ミライ\nご相談内容: 料金について");
    expect(vars.meeting_url).toBe("https://meet.example.com/abc");
    expect(vars.location).toBe("");
    expect(vars.agenda).toBe("");
  });
  it("毎日のオートメーションは、その日の予定の一覧を agenda に入れる", () => {
    const vars = buildTemplateVariables(null, "Asia/Tokyo", { date: new Date("2026-10-05T00:00:00Z"), events: [event] });
    expect(vars.title).toBe("");
    expect(vars.agenda).toBe("2026年10月5日(月)\n- 14:00〜14:30 初回のご相談 / 佐藤 太郎 さん");
  });
  it("予定が無い日", () => {
    const vars = buildTemplateVariables(null, "Asia/Tokyo", { date: new Date("2026-10-05T00:00:00Z"), events: [] });
    expect(vars.agenda).toContain("予定はありません");
  });
});

describe("truncate", () => {
  it("文字数で切り詰める", () => {
    expect(truncate("あいうえお", 5)).toBe("あいうえお");
    expect(truncate("あいうえおか", 5)).toBe("あいうえ…");
  });
});
