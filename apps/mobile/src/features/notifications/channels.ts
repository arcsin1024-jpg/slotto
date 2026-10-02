import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/**
 * Android の通知チャンネル。作った後は名前と説明しか変えられない(OS の制限)。
 * 音や重要度を変えるときは、新しい ID のチャンネルを作り、古いものを消す。
 *
 * サーバーからのプッシュ通知(S4)も、同じ ID を channelId に指定する。
 */
export const CHANNELS = {
  /** 予定の通知。開始の何分前かに知らせる */
  reminder: "event-reminder",
  /** アラーム。通知より強く、アラームの音量で鳴らす。専用の音は未定(決めたら ID を変えて作り直す) */
  alarm: "event-alarm",
  /** オートメーションの結果(AI の出力、Webhook の結果など) */
  automation: "automation-result",
  /** 予約が入った・キャンセルされた、など */
  booking: "booking-update",
} as const;

export type ChannelId = (typeof CHANNELS)[keyof typeof CHANNELS];

/** 通知のボタン。会議 URL のある予定に「参加する」を付ける */
export const CATEGORIES = {
  event: "event",
  eventWithMeeting: "event-with-meeting",
} as const;

export const ACTIONS = {
  join: "join",
  open: "open",
} as const;

/**
 * チャンネルとボタンを用意する。何度呼んでもよい。
 * Android 13 以降は、チャンネルが 1 つ以上ないと通知の許可ダイアログが出ないので、許可を求める前に呼ぶ。
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS === "android") {
    await Promise.all([
      Notifications.setNotificationChannelAsync(CHANNELS.reminder, {
        name: "予定の通知",
        description: "予定が始まる前に知らせます",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
        vibrationPattern: [0, 250, 250, 250],
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      }),
      Notifications.setNotificationChannelAsync(CHANNELS.alarm, {
        name: "アラーム",
        description: "予定の時間にアラームの音量で鳴らします",
        importance: Notifications.AndroidImportance.MAX,
        sound: "default",
        vibrationPattern: [0, 800, 400, 800, 400, 800],
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        audioAttributes: {
          usage: Notifications.AndroidAudioUsage.ALARM,
          contentType: Notifications.AndroidAudioContentType.SONIFICATION,
        },
      }),
      Notifications.setNotificationChannelAsync(CHANNELS.automation, {
        name: "オートメーションの結果",
        description: "AI の実行結果や、API を呼んだ結果を知らせます",
        importance: Notifications.AndroidImportance.DEFAULT,
      }),
      Notifications.setNotificationChannelAsync(CHANNELS.booking, {
        name: "予約の更新",
        description: "予約が入ったとき、キャンセルされたときなどに知らせます",
        importance: Notifications.AndroidImportance.HIGH,
      }),
    ]);
  }

  await Promise.all([
    Notifications.setNotificationCategoryAsync(CATEGORIES.event, [
      { identifier: ACTIONS.open, buttonTitle: "詳細を見る", options: { opensAppToForeground: true } },
    ]),
    Notifications.setNotificationCategoryAsync(CATEGORIES.eventWithMeeting, [
      { identifier: ACTIONS.join, buttonTitle: "参加する", options: { opensAppToForeground: true } },
      { identifier: ACTIONS.open, buttonTitle: "詳細を見る", options: { opensAppToForeground: true } },
    ]),
  ]);
}
