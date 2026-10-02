import {
  formatDateTimeRange,
  formatFullDate,
  formatTime,
  LOCATION_LABELS,
  type FormField,
  type LocationType,
} from "@slotto/core";
import type { BookingRow } from "@slotto/core/database";
import type { BookingEmailKind } from "./kinds";

/**
 * 予約に関するメールの文面。外部への通信をしない純粋な関数。
 * 文言はこのファイルにまとめる(後で英語を足すときはここを分ける)。
 */

export type EmailRecipient = "guest" | "host";

export interface EmailContext {
  kind: BookingEmailKind;
  recipient: EmailRecipient;
  booking: Pick<
    BookingRow,
    | "title"
    | "status"
    | "starts_at"
    | "ends_at"
    | "guest_name"
    | "guest_email"
    | "guest_timezone"
    | "location_type"
    | "location_value"
    | "meeting_url"
    | "cancelled_by"
    | "cancel_reason"
    | "answers"
  >;
  host: { display_name: string; timezone: string };
  /** 日程変更前の日時 */
  previous?: { starts_at: string; ends_at: string } | null;
  formFields: FormField[];
  /** ゲスト用の確認・変更・キャンセルのページ */
  manageUrl: string;
  /** ホスト用の予約の詳細のページ */
  hostUrl: string;
  completionMessage?: string | null;
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

interface Section {
  heading: string;
  intro: string[];
  rows: [string, string][];
  actions: { label: string; url: string }[];
  note?: string[];
}

const FOOTER = "このメールは Slotto から自動で送信しています。";

function timeZoneLabel(timeZone: string): string {
  return timeZone === "Asia/Tokyo" ? "日本時間" : timeZone;
}

function when(start: string, end: string, timeZone: string): string {
  return `${formatFullDate(start, timeZone)} ${formatTime(start, timeZone)}〜${formatTime(end, timeZone)}(${timeZoneLabel(timeZone)})`;
}

/** 場所の表示。承認待ちの予約には、会議 URL や住所を載せない */
function locationText(booking: EmailContext["booking"]): string | null {
  const type = booking.location_type as LocationType;
  if (type === "none") return null;
  const label = LOCATION_LABELS[type] ?? booking.location_type;
  if (booking.status !== "confirmed") return label;
  if (booking.meeting_url) return `${label} ${booking.meeting_url}`;
  if (booking.location_value) return `${label} ${booking.location_value}`;
  if (type === "google_meet") return `${label}(URL は主催者からの連絡をお待ちください)`;
  return label;
}

function answerRows(fields: FormField[], answers: unknown): [string, string][] {
  if (!answers || typeof answers !== "object") return [];
  const record = answers as Record<string, unknown>;
  const rows: [string, string][] = [];
  for (const field of fields) {
    const value = record[field.id];
    if (value === undefined || value === "" || value === false) continue;
    const text = value === true ? "はい" : Array.isArray(value) ? value.join("、") : String(value);
    rows.push([field.label, text]);
  }
  return rows;
}

function guestSection(ctx: EmailContext): Section {
  const { booking, host } = ctx;
  const tz = booking.guest_timezone;
  const rows: [string, string][] = [
    ["予定", booking.title],
    ["日時", when(booking.starts_at, booking.ends_at, tz)],
  ];
  const location = locationText(booking);
  if (location) rows.push(["場所", location]);
  rows.push(["主催者", host.display_name]);
  const manage = { label: "予約の確認・変更・キャンセル", url: ctx.manageUrl };
  const name = `${booking.guest_name} 様`;

  switch (ctx.kind) {
    case "booking_confirmed":
      return {
        heading: "予約が確定しました",
        intro: [name, `${host.display_name} さんとの予定が確定しました。カレンダーに追加するファイルを添付しています。`],
        rows,
        actions: [manage],
        note: ctx.completionMessage ? [ctx.completionMessage] : undefined,
      };
    case "booking_requested":
      return {
        heading: "予約の申請を受け付けました",
        intro: [name, `${host.display_name} さんが承認すると予約が確定し、あらためてメールでお知らせします。`],
        rows,
        actions: [manage],
      };
    case "booking_declined":
      return {
        heading: "予約をお受けできませんでした",
        intro: [name, `申し訳ありません。${host.display_name} さんの都合により、次の予約はお受けできませんでした。`],
        rows,
        actions: [],
        note: booking.cancel_reason ? [`理由: ${booking.cancel_reason}`] : undefined,
      };
    case "booking_cancelled":
      return {
        heading: "予約がキャンセルされました",
        intro: [
          name,
          booking.cancelled_by === "host"
            ? `${host.display_name} さんの都合により、次の予約がキャンセルされました。`
            : "次の予約のキャンセルを受け付けました。",
        ],
        rows,
        actions: [],
        note: booking.cancel_reason ? [`理由: ${booking.cancel_reason}`] : undefined,
      };
    case "booking_rescheduled": {
      const changed: [string, string][] = ctx.previous
        ? [["変更前の日時", when(ctx.previous.starts_at, ctx.previous.ends_at, tz)]]
        : [];
      return booking.status === "pending"
        ? {
            heading: "日時の変更を申請しました",
            intro: [name, `${host.display_name} さんが承認すると新しい日時で確定し、あらためてメールでお知らせします。`],
            rows: [...rows, ...changed],
            actions: [manage],
          }
        : {
            heading: "予約の日時を変更しました",
            intro: [name, "次の日時に変更しました。カレンダーに追加するファイルを添付しています。"],
            rows: [...rows, ...changed],
            actions: [manage],
          };
    }
    case "booking_reminder":
      return {
        heading: "まもなく予定の時間です",
        intro: [name, `${host.display_name} さんとの予定が近づいています。`],
        rows,
        actions: [manage],
      };
  }
}

function hostSection(ctx: EmailContext): Section {
  const { booking, host } = ctx;
  const tz = host.timezone;
  const rows: [string, string][] = [
    ["予定", booking.title],
    ["日時", when(booking.starts_at, booking.ends_at, tz)],
    ["お名前", booking.guest_name],
    ["メール", booking.guest_email],
    ...answerRows(ctx.formFields, booking.answers),
  ];
  const location = locationText(booking);
  if (location) rows.push(["場所", location]);
  const open = { label: "予約の詳細を開く", url: ctx.hostUrl };

  switch (ctx.kind) {
    case "booking_confirmed":
      return { heading: "新しい予約が入りました", intro: [`${booking.guest_name} さんから予約が入りました。`], rows, actions: [open] };
    case "booking_requested":
      return {
        heading: "承認待ちの予約があります",
        intro: [`${booking.guest_name} さんから予約の申請がありました。承認または辞退してください。`],
        rows,
        actions: [{ label: "承認・辞退する", url: ctx.hostUrl }],
      };
    case "booking_declined":
      return { heading: "予約を辞退しました", intro: [`${booking.guest_name} さんの予約を辞退しました。`], rows, actions: [open] };
    case "booking_cancelled":
      return {
        heading: "予約がキャンセルされました",
        intro: [`${booking.guest_name} さんが予約をキャンセルしました。`],
        rows,
        actions: [open],
        note: booking.cancel_reason ? [`理由: ${booking.cancel_reason}`] : undefined,
      };
    case "booking_rescheduled":
      return {
        heading: booking.status === "pending" ? "日時の変更の申請があります" : "予約の日時が変更されました",
        intro: [
          booking.status === "pending"
            ? `${booking.guest_name} さんから日時の変更の申請がありました。承認または辞退してください。`
            : `${booking.guest_name} さんが予約の日時を変更しました。`,
        ],
        rows: ctx.previous ? [...rows, ["変更前の日時", when(ctx.previous.starts_at, ctx.previous.ends_at, tz)]] : rows,
        actions: [open],
      };
    case "booking_reminder":
      return {
        heading: "まもなく予定の時間です",
        intro: [`${booking.guest_name} さんとの予定が近づいています。`],
        rows,
        actions: [open],
      };
  }
}

function subjectOf(ctx: EmailContext, section: Section): string {
  const { booking } = ctx;
  const tz = ctx.recipient === "guest" ? booking.guest_timezone : ctx.host.timezone;
  const range = formatDateTimeRange(booking.starts_at, booking.ends_at, tz);
  if (ctx.recipient === "guest") return `${section.heading}: ${booking.title}(${range})`;
  return `${section.heading}: ${booking.guest_name} さん(${range})`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toText(section: Section): string {
  const lines: string[] = [...section.intro, ""];
  for (const [label, value] of section.rows) lines.push(`${label}: ${value}`);
  if (section.note?.length) lines.push("", ...section.note);
  for (const action of section.actions) lines.push("", `${action.label}:`, action.url);
  lines.push("", "--", FOOTER);
  return lines.join("\n");
}

function toHtml(section: Section): string {
  const intro = section.intro.map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`).join("");
  const rows = section.rows
    .map(
      ([label, value]) =>
        `<tr><th align="left" style="padding:6px 16px 6px 0;color:#6b7280;font-weight:normal;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</th><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const note = (section.note ?? []).map((line) => `<p style="margin:16px 0 0;white-space:pre-wrap">${escapeHtml(line)}</p>`).join("");
  const actions = section.actions
    .map(
      (action) =>
        `<p style="margin:20px 0 0"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 16px;border-radius:6px;background:#1f2937;color:#ffffff;text-decoration:none">${escapeHtml(action.label)}</a></p>`,
    )
    .join("");
  return [
    '<!doctype html><html lang="ja"><body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,\'Hiragino Sans\',\'Noto Sans JP\',sans-serif;color:#111827;font-size:14px;line-height:1.7">',
    '<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:8px;padding:24px">',
    `<h1 style="margin:0 0 16px;font-size:18px">${escapeHtml(section.heading)}</h1>`,
    intro,
    `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">${rows}</table>`,
    note,
    actions,
    "</div>",
    `<p style="max-width:560px;margin:16px auto 0;color:#9ca3af;font-size:12px">${escapeHtml(FOOTER)}</p>`,
    "</body></html>",
  ].join("");
}

export function renderBookingEmail(ctx: EmailContext): EmailContent {
  const section = ctx.recipient === "guest" ? guestSection(ctx) : hostSection(ctx);
  return { subject: subjectOf(ctx, section), text: toText(section), html: toHtml(section) };
}
