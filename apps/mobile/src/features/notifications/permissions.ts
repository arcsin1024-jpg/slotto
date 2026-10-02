import * as Notifications from "expo-notifications";
import { Linking } from "react-native";
import { setupNotificationChannels } from "./channels";

export type NotificationPermission = "granted" | "denied" | "undetermined";

export async function getNotificationPermission(): Promise<NotificationPermission> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return "granted";
  // iOS の「仮の許可」(provisional)は通知センターにしか出ないが、鳴らないよりはよいので許可とみなす
  if (settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) return "granted";
  return settings.canAskAgain ? "undetermined" : "denied";
}

/**
 * 通知の許可を求める。理由が伝わる場面(通知・アラームを設定したとき、オートメーションを作ったとき)で呼ぶ。
 * 初回起動時にいきなり呼ばない。一度拒否されると OS の設定画面でしか変えられない。
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  const current = await getNotificationPermission();
  if (current !== "undetermined") return current;
  await setupNotificationChannels();
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return result.granted ? "granted" : result.canAskAgain ? "undetermined" : "denied";
}

/** 拒否されたときに、OS のアプリ設定を開く */
export function openNotificationSettings(): Promise<void> {
  return Linking.openSettings();
}
