import type { Href } from "expo-router";
import { ACTIONS } from "./channels";

/**
 * 通知をタップしたときの行き先。ローカル通知とプッシュ通知(S4 の sendPush)の data は同じ形:
 * - { type: "booking", id }           予約の詳細
 * - { type: "external_event", id }    反映中の外部予定の詳細
 * - { type: "automation_run", id }    オートメーションの実行結果
 * - { type: "open_url", url }         URL を開く(会議に参加など)
 * 予定の通知に url(会議 URL)があり、「参加する」ボタンが押されたときは URL を開く。
 */
export type NotificationTarget =
  | { kind: "route"; href: Href }
  | { kind: "url"; url: string }
  | { kind: "none" };

export function notificationTarget(data: unknown, actionIdentifier?: string): NotificationTarget {
  if (!data || typeof data !== "object") return { kind: "none" };
  const record = data as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : null;
  const id = typeof record.id === "string" ? record.id : null;
  const url = typeof record.url === "string" && /^https?:\/\//.test(record.url) ? record.url : null;

  if (actionIdentifier === ACTIONS.join && url) return { kind: "url", url };

  switch (type) {
    case "booking":
      return id ? { kind: "route", href: { pathname: "/bookings/[id]", params: { id } } } : { kind: "none" };
    case "external_event":
      return id ? { kind: "route", href: { pathname: "/events/[id]", params: { id } } } : { kind: "none" };
    case "automation_run":
      return id ? { kind: "route", href: { pathname: "/runs/[id]", params: { id } } } : { kind: "none" };
    case "open_url":
      return url ? { kind: "url", url } : { kind: "none" };
    default:
      return { kind: "none" };
  }
}
