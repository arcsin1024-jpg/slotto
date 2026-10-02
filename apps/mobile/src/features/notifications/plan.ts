/**
 * 端末のローカル通知の予約計画。外部への通信をしない純粋な関数(単体テストあり)。
 *
 * - iOS は保留できる通知が 1 アプリ 64 件まで(近い順に残り、残りは捨てられる)。
 *   ほかの用途の余地を残して、近い順に MAX_SCHEDULED 件だけ予約する
 * - 予定の追加・変更・キャンセルは、起動時・前面に戻ったとき・プッシュ受信時の張り直しで反映する
 */

import { formatLeadTime, formatTime } from "@slotto/core";

export const MAX_SCHEDULED = 48;
/** 何日先までの予定を見るか */
export const PLAN_WINDOW_DAYS = 14;
/** これより直前の通知は予約しない(予約した瞬間に鳴るのを防ぐ) */
const MIN_LEAD_MS = 5_000;

/** 通知の識別子の頭。これで始まるものだけを Slotto の予定の通知として扱う */
export const IDENTIFIER_PREFIX = "slotto:event:";

export type PlanKind = "notify" | "alarm";

export interface PlanEvent {
  sourceType: "booking" | "external_event";
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  isAllDay: boolean;
  /** 予約の状態。外部予定は null */
  status: "pending" | "confirmed" | "cancelled" | "declined" | null;
  meetingUrl: string | null;
}

export interface PlanDefaults {
  notifyMinutes: number[];
  alarmMinutes: number[];
  /** 反映中の外部予定も知らせるか */
  notifySelectedEvents: boolean;
}

export interface PlanOverride {
  sourceType: "booking" | "external_event";
  sourceId: string;
  notifyMinutes: number[];
  alarmMinutes: number[];
  isMuted: boolean;
}

/** 通知に載せるデータ。プッシュ通知(S4)と同じ形にして、タップしたときの処理を共通にする */
export interface NotificationData {
  type: "booking" | "external_event";
  id: string;
  /** 会議 URL。「参加」ボタンで開く */
  url?: string;
  /** 予約の内容が変わったら予約し直すための目印 */
  signature: string;
  [key: string]: unknown;
}

export interface PlannedNotification {
  identifier: string;
  kind: PlanKind;
  fireAt: Date;
  minutesBefore: number;
  title: string;
  body: string;
  data: NotificationData;
}

export const DEFAULT_PLAN_DEFAULTS: PlanDefaults = {
  notifyMinutes: [10],
  alarmMinutes: [],
  notifySelectedEvents: true,
};

export function planNotifications(input: {
  events: PlanEvent[];
  defaults: PlanDefaults;
  overrides: PlanOverride[];
  now: Date;
  timeZone: string;
  limit?: number;
}): PlannedNotification[] {
  const { events, defaults, now, timeZone } = input;
  const limit = input.limit ?? MAX_SCHEDULED;
  const overrideByKey = new Map(input.overrides.map((o) => [`${o.sourceType}:${o.sourceId}`, o]));
  const planned: PlannedNotification[] = [];

  for (const event of events) {
    if (event.isAllDay) continue;
    // 承認待ち・キャンセル済みの予約は鳴らさない
    if (event.sourceType === "booking" && event.status !== "confirmed") continue;

    const override = overrideByKey.get(`${event.sourceType}:${event.id}`);
    if (override?.isMuted) continue;
    if (!override && event.sourceType === "external_event" && !defaults.notifySelectedEvents) continue;

    const notifyMinutes = override?.notifyMinutes ?? defaults.notifyMinutes;
    const alarmMinutes = override?.alarmMinutes ?? defaults.alarmMinutes;
    const start = new Date(event.startsAt);
    const signature = `${event.startsAt}|${event.endsAt}|${event.title}|${event.meetingUrl ?? ""}`;

    // 同じ分数が通知とアラームの両方にあれば、アラームを優先する
    const minutesByKind = new Map<number, PlanKind>();
    for (const minutes of notifyMinutes) minutesByKind.set(minutes, "notify");
    for (const minutes of alarmMinutes) minutesByKind.set(minutes, "alarm");

    for (const [minutes, kind] of minutesByKind) {
      if (!Number.isInteger(minutes) || minutes < 0) continue;
      const fireAt = new Date(start.getTime() - minutes * 60_000);
      if (fireAt.getTime() - now.getTime() < MIN_LEAD_MS) continue;
      planned.push({
        identifier: `${IDENTIFIER_PREFIX}${event.sourceType}:${event.id}:${kind}:${minutes}`,
        kind,
        fireAt,
        minutesBefore: minutes,
        title: kind === "alarm" ? `まもなく開始: ${event.title}` : event.title,
        body: notificationBody(minutes, event, timeZone),
        data: {
          type: event.sourceType,
          id: event.id,
          ...(event.meetingUrl ? { url: event.meetingUrl } : {}),
          signature,
        },
      });
    }
  }

  return planned.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime()).slice(0, limit);
}

function notificationBody(minutes: number, event: PlanEvent, timeZone: string): string {
  const range = `${formatTime(event.startsAt, timeZone)}〜${formatTime(event.endsAt, timeZone)}`;
  if (minutes === 0) return `今から始まります(${range})`;
  // formatLeadTime は「10 分前」の形なので「後」に言い換える
  const lead = formatLeadTime(minutes).replace(/前$/, "後");
  return `${lead}に始まります(${range})`;
}

export interface ScheduledSnapshot {
  identifier: string;
  signature: string | null;
}

/**
 * いま予約されている通知と計画を比べて、取り消すものと新しく予約するものを出す。
 * Slotto の予定の通知(IDENTIFIER_PREFIX で始まるもの)以外には触らない。
 */
export function diffSchedule(
  scheduled: ScheduledSnapshot[],
  planned: PlannedNotification[],
): { cancel: string[]; schedule: PlannedNotification[] } {
  const plannedById = new Map(planned.map((p) => [p.identifier, p]));
  const keep = new Set<string>();
  const cancel: string[] = [];
  for (const item of scheduled) {
    if (!item.identifier.startsWith(IDENTIFIER_PREFIX)) continue;
    const plan = plannedById.get(item.identifier);
    if (plan && plan.data.signature === item.signature) keep.add(item.identifier);
    else cancel.push(item.identifier);
  }
  return { cancel, schedule: planned.filter((p) => !keep.has(p.identifier)) };
}
