import { useQueryClient } from "@tanstack/react-query";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Linking } from "react-native";
import { setupNotificationChannels } from "./channels";
import { registerPushToken } from "./push";
import { notificationTarget } from "./routing";
import { syncLocalNotifications } from "./scheduler";

// アプリが前面にあるときも通知を表示する
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * ログイン後の画面に 1 つだけ置く。画面は持たない。
 * - 起動時と前面に戻ったときに、通知の張り直しとプッシュのトークン登録をする
 * - プッシュを受け取ったら、データを読み直して通知を張り直す(予約の追加・キャンセルなど)
 * - 通知をタップしたら、該当の画面を開く(アプリが閉じていた状態からの起動も含む)
 */
export function NotificationBridge() {
  const queryClient = useQueryClient();
  const handledResponse = useRef<string | null>(null);
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    void (async () => {
      await setupNotificationChannels();
      await syncLocalNotifications();
      await registerPushToken();
    })();

    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active") void syncLocalNotifications();
    });

    const received = Notifications.addNotificationReceivedListener((notification) => {
      // ローカル通知(自分で予約したもの)が鳴ったときは何もしない
      const trigger = notification.request.trigger;
      if (!trigger || !("type" in trigger) || trigger.type !== "push") return;
      void queryClient.invalidateQueries();
      void syncLocalNotifications();
    });

    return () => {
      appState.remove();
      received.remove();
    };
  }, [queryClient]);

  useEffect(() => {
    if (!lastResponse) return;
    // 同じ通知を 2 回処理しない(画面の再描画でもう一度届くことがある)
    const key = `${lastResponse.notification.request.identifier}:${lastResponse.notification.date}:${lastResponse.actionIdentifier}`;
    if (handledResponse.current === key) return;
    handledResponse.current = key;

    const target = notificationTarget(
      lastResponse.notification.request.content.data,
      lastResponse.actionIdentifier,
    );
    if (target.kind === "route") router.push(target.href);
    if (target.kind === "url") void Linking.openURL(target.url);
    Notifications.clearLastNotificationResponse();
  }, [lastResponse]);

  return null;
}
