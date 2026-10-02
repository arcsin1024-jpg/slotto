import { describe, expect, it } from "vitest";
import { renderBookingEmail, type EmailContext } from "./templates";

const base: EmailContext = {
  kind: "booking_confirmed",
  recipient: "guest",
  booking: {
    title: "30 分のオンライン相談",
    status: "confirmed",
    starts_at: "2026-10-05T01:00:00.000Z",
    ends_at: "2026-10-05T01:30:00.000Z",
    guest_name: "佐藤 健",
    guest_email: "sato@example.com",
    guest_timezone: "Asia/Tokyo",
    location_type: "google_meet",
    location_value: null,
    meeting_url: "https://meet.google.com/abc-defg-hij",
    cancelled_by: null,
    cancel_reason: null,
    answers: { company: "株式会社ミライ" },
  },
  host: { display_name: "山田 花子", timezone: "Asia/Tokyo" },
  formFields: [{ id: "company", type: "text", label: "会社名", required: true }],
  manageUrl: "https://example.com/b/token",
  hostUrl: "https://example.com/app/bookings?id=1",
};

describe("renderBookingEmail", () => {
  it("ゲスト宛ての確定メールに、日時(ゲストのタイムゾーン)、会議 URL、変更・キャンセルのリンクを入れる", () => {
    const mail = renderBookingEmail(base);
    expect(mail.subject).toContain("予約が確定しました");
    expect(mail.text).toContain("2026年10月5日(月) 10:00〜10:30(日本時間)");
    expect(mail.text).toContain("https://meet.google.com/abc-defg-hij");
    expect(mail.text).toContain("https://example.com/b/token");
    expect(mail.html).toContain('href="https://example.com/b/token"');
  });

  it("ゲストのタイムゾーンで表示する", () => {
    const mail = renderBookingEmail({ ...base, booking: { ...base.booking, guest_timezone: "America/New_York" } });
    expect(mail.text).toContain("2026年10月4日(日) 21:00〜21:30(America/New_York)");
  });

  it("承認待ちのときは会議 URL を載せない", () => {
    const mail = renderBookingEmail({
      ...base,
      kind: "booking_requested",
      booking: { ...base.booking, status: "pending" },
    });
    expect(mail.subject).toContain("申請を受け付けました");
    expect(mail.text).not.toContain("meet.google.com");
  });

  it("ホスト宛てには回答とゲストの連絡先を入れる", () => {
    const mail = renderBookingEmail({ ...base, recipient: "host" });
    expect(mail.subject).toBe("新しい予約が入りました: 佐藤 健 さん(10月5日(月) 10:00〜10:30)");
    expect(mail.text).toContain("会社名: 株式会社ミライ");
    expect(mail.text).toContain("sato@example.com");
  });

  it("日程変更のメールに変更前の日時を入れる", () => {
    const mail = renderBookingEmail({
      ...base,
      kind: "booking_rescheduled",
      previous: { starts_at: "2026-10-04T05:00:00.000Z", ends_at: "2026-10-04T05:30:00.000Z" },
    });
    expect(mail.text).toContain("変更前の日時: 2026年10月4日(日) 14:00〜14:30(日本時間)");
  });

  it("HTML では値をエスケープする", () => {
    const mail = renderBookingEmail({ ...base, booking: { ...base.booking, title: "<script>" } });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
  });
});
