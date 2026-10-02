import { formatDateTimeRange, formatFullDate, formatTime, type AutomationVariableKey } from "@slotto/core";

/**
 * 文面の差し込み(`{{title}}` など)。外部への通信をしない純粋な関数だけを置く(単体テストの対象)。
 */

export type TemplateVariables = Record<AutomationVariableKey, string>;

/** オートメーションに渡す予定の情報 */
export interface EventDetails {
  source_type: "booking" | "external_event";
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  is_all_day: boolean;
  location: string | null;
  meeting_url: string | null;
  guest_name: string | null;
  guest_email: string | null;
  /** 予約フォームの回答(質問文と回答) */
  answers: Array<{ label: string; value: string }>;
  booking_page_id: string | null;
}

const PATTERN = /\{\{\s*([A-Za-z_]+)\s*\}\}/g;

/**
 * `{{key}}` を値に置き換える。知らないキーは空にする。
 * encode を渡すと、値をそれで包む(AI への指示文では JSON の文字列にして、区切りを破られないようにする)。
 */
export function expandTemplate(
  template: string,
  variables: Partial<Record<string, string>>,
  encode?: (value: string) => string,
): string {
  return template.replace(PATTERN, (_, key: string) => {
    const value = Object.hasOwn(variables, key) ? (variables[key] ?? "") : "";
    return encode ? encode(value) : value;
  });
}

/** 差し込みに使われているキー */
export function templateKeys(template: string): string[] {
  return [...new Set([...template.matchAll(PATTERN)].map((m) => m[1]!))];
}

export function formatAnswers(answers: EventDetails["answers"]): string {
  return answers.map((a) => `${a.label}: ${a.value}`).join("\n");
}

/** 予定 1 件を一覧用の 1 行にする。例: 10:00〜11:00 週次定例(会議室 A) */
export function formatAgendaLine(event: EventDetails, timeZone: string): string {
  const time = event.is_all_day
    ? "終日"
    : `${formatTime(event.starts_at, timeZone)}〜${formatTime(event.ends_at, timeZone)}`;
  const place = event.location ? `(${event.location})` : "";
  const guest = event.guest_name ? ` / ${event.guest_name} さん` : "";
  return `${time} ${event.title}${place}${guest}`;
}

export function formatAgenda(events: EventDetails[], timeZone: string): string {
  if (events.length === 0) return "予定はありません";
  return events.map((e) => `- ${formatAgendaLine(e, timeZone)}`).join("\n");
}

/** 差し込みの値を作る。日時はホストのタイムゾーンで表示する */
export function buildTemplateVariables(
  event: EventDetails | null,
  timeZone: string,
  agenda: { date: Date; events: EventDetails[] } | null,
): TemplateVariables {
  const agendaText = agenda ? `${formatFullDate(agenda.date, timeZone)}\n${formatAgenda(agenda.events, timeZone)}` : "";
  if (!event) {
    return {
      title: "",
      start: "",
      end: "",
      guest_name: "",
      guest_email: "",
      location: "",
      meeting_url: "",
      answers: "",
      agenda: agendaText,
    };
  }
  const start = event.is_all_day
    ? formatFullDate(event.starts_at, timeZone)
    : `${formatFullDate(event.starts_at, timeZone)} ${formatTime(event.starts_at, timeZone)}`;
  const end = event.is_all_day
    ? formatFullDate(event.ends_at, timeZone)
    : `${formatFullDate(event.ends_at, timeZone)} ${formatTime(event.ends_at, timeZone)}`;
  return {
    title: event.title,
    start,
    end,
    guest_name: event.guest_name ?? "",
    guest_email: event.guest_email ?? "",
    location: event.location ?? "",
    meeting_url: event.meeting_url ?? "",
    answers: formatAnswers(event.answers),
    agenda: agendaText,
  };
}

/** 通知の本文などに使う、予定の短い説明。例: 10月2日(金) 14:30〜15:00 */
export function describeEventTime(event: EventDetails, timeZone: string): string {
  return formatDateTimeRange(event.starts_at, event.ends_at, timeZone);
}

/** 文字数で切り詰める(通知の本文の上限に合わせる) */
export function truncate(text: string, max: number): string {
  const chars = [...text];
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join("")}…`;
}
