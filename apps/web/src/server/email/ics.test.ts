import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, icsSequence, icsUid, type IcsEvent } from "./ics";

const event: IcsEvent = {
  method: "REQUEST",
  uid: icsUid("11111111-2222-4333-8444-555555555555"),
  sequence: 0,
  start: "2026-10-05T01:00:00.000Z",
  end: "2026-10-05T01:30:00.000Z",
  stamp: new Date("2026-10-03T00:00:00.000Z"),
  title: "30 分のオンライン相談",
  description: "予約の確認・変更・キャンセル: https://example.com/b/abc",
  location: "https://meet.google.com/abc-defg-hij",
  url: "https://example.com/b/abc",
  organizer: { name: "山田 花子", email: "hanako@example.com" },
  attendee: { name: "佐藤, 健", email: "sato@example.com" },
};

/** 折り返しを戻して、1 行ずつの配列にする */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n /g, "").split("\r\n");
}

describe("buildIcs", () => {
  it("招待(REQUEST)を UTC の時刻と CRLF で書く", () => {
    const ics = buildIcs(event);
    expect(ics.endsWith("\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n/);
    const lines = unfold(ics);
    expect(lines).toContain("METHOD:REQUEST");
    expect(lines).toContain("UID:11111111-2222-4333-8444-555555555555@slotto");
    expect(lines).toContain("SEQUENCE:0");
    expect(lines).toContain("DTSTAMP:20261003T000000Z");
    expect(lines).toContain("DTSTART:20261005T010000Z");
    expect(lines).toContain("DTEND:20261005T013000Z");
    expect(lines).toContain("STATUS:CONFIRMED");
    expect(lines).toContain("SUMMARY:30 分のオンライン相談");
    expect(lines).toContain('ORGANIZER;CN="山田 花子":mailto:hanako@example.com');
    expect(lines).toContain(
      'ATTENDEE;CN="佐藤, 健";ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:sato@example.com',
    );
  });

  it("取り消し(CANCEL)は STATUS:CANCELLED", () => {
    const lines = unfold(buildIcs({ ...event, method: "CANCEL", sequence: 1 }));
    expect(lines).toContain("METHOD:CANCEL");
    expect(lines).toContain("STATUS:CANCELLED");
    expect(lines).toContain("SEQUENCE:1");
  });

  it("どの行も 75 オクテットを超えない", () => {
    const ics = buildIcs({ ...event, description: "日本語の長い説明文です。".repeat(20) });
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n")) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("escapeText", () => {
  it("バックスラッシュ、セミコロン、カンマ、改行をエスケープする", () => {
    expect(escapeText("a\\b;c,d\ne\r\nf")).toBe("a\\\\b\\;c\\,d\\ne\\nf");
  });
});

describe("foldLine", () => {
  it("短い行はそのまま", () => {
    expect(foldLine("SUMMARY:短い")).toBe("SUMMARY:短い");
  });

  it("マルチバイト文字の途中で切らない", () => {
    const folded = foldLine(`SUMMARY:${"あ".repeat(60)}`);
    const parts = folded.split("\r\n ");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.join("")).toBe(`SUMMARY:${"あ".repeat(60)}`);
    const encoder = new TextEncoder();
    expect(encoder.encode(parts[0]!).length).toBeLessThanOrEqual(75);
    for (const part of parts.slice(1)) expect(encoder.encode(part).length).toBeLessThanOrEqual(74);
  });
});

describe("icsSequence", () => {
  it("日程変更のたびに増え、取り消しは招待より大きい", () => {
    expect(icsSequence("REQUEST", 0)).toBe(0);
    expect(icsSequence("CANCEL", 0)).toBe(1);
    expect(icsSequence("REQUEST", 1)).toBe(2);
    expect(icsSequence("CANCEL", 1)).toBe(3);
  });
});
