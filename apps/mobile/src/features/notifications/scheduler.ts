import { DEFAULT_TIMEZONE } from "@slotto/core";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { fetchEventAlarms } from "@/features/data/alarms";
import { fetchAgenda } from "@/features/data/agenda";
import { currentUserId, unwrapMaybe } from "@/features/data/util";
import { supabase } from "@/lib/supabase";
import { CATEGORIES, CHANNELS } from "./channels";
import { getNotificationPermission } from "./permissions";
import {
  DEFAULT_PLAN_DEFAULTS,
  diffSchedule,
  IDENTIFIER_PREFIX,
  PLAN_WINDOW_DAYS,
  type PlannedNotification,
  planNotifications,
} from "./plan";

export interface SyncResult {
  status: "synced" | "no_permission" | "failed";
  scheduled: number;
  cancelled: number;
}

let running: Promise<SyncResult> | null = null;
let queued = false;

/**
 * 直近の予定の通知・アラームを張り直す。起動時、前面に戻ったとき、プッシュを受け取ったとき、
 * 設定を変えたときに呼ぶ。同時に呼ばれたら、実行中のものが終わってからもう 1 回だけ走らせる。
 */
export function syncLocalNotifications(): Promise<SyncResult> {
  if (running) {
    queued = true;
    return running;
  }
  running = runSync().finally(() => {
    running = null;
    if (queued) {
      queued = false;
      void syncLocalNotifications();
    }
  });
  return running;
}

async function runSync(): Promise<SyncResult> {
  try {
    if ((await getNotificationPermission()) !== "granted") {
      return { status: "no_permission", scheduled: 0, cancelled: 0 };
    }

    const userId = await currentUserId();
    const now = new Date();
    const until = new Date(now.getTime() + PLAN_WINDOW_DAYS * 86_400_000);

    const [events, settingsResult, profileResult] = await Promise.all([
      fetchAgenda(now.toISOString(), until.toISOString()),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("profiles").select("timezone").eq("id", userId).maybeSingle(),
    ]);
    const settings = unwrapMaybe(settingsResult);
    const timeZone = unwrapMaybe(profileResult)?.timezone ?? DEFAULT_TIMEZONE;
    const overrides = await fetchEventAlarms(events.map((event) => event.id));

    const planned = planNotifications({
      events,
      defaults: settings
        ? {
            notifyMinutes: settings.notify_minutes,
            alarmMinutes: settings.alarm_minutes,
            notifySelectedEvents: settings.notify_selected_events,
          }
        : DEFAULT_PLAN_DEFAULTS,
      overrides: overrides.map((row) => ({
        sourceType: row.source_type,
        sourceId: row.source_id,
        notifyMinutes: row.notify_minutes,
        alarmMinutes: row.alarm_minutes,
        isMuted: row.is_muted,
      })),
      now,
      timeZone,
    });

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const { cancel, schedule } = diffSchedule(
      scheduled.map((request) => ({
        identifier: request.identifier,
        signature: typeof request.content.data?.signature === "string" ? request.content.data.signature : null,
      })),
      planned,
    );

    for (const identifier of cancel) await Notifications.cancelScheduledNotificationAsync(identifier);
    for (const plan of schedule) await scheduleOne(plan);
    return { status: "synced", scheduled: schedule.length, cancelled: cancel.length };
  } catch (error) {
    console.warn("[notifications] 張り直しに失敗しました", error);
    return { status: "failed", scheduled: 0, cancelled: 0 };
  }
}

function scheduleOne(plan: PlannedNotification): Promise<string> {
  const isAlarm = plan.kind === "alarm";
  return Notifications.scheduleNotificationAsync({
    identifier: plan.identifier,
    content: {
      title: plan.title,
      body: plan.body,
      data: plan.data,
      sound: "default",
      categoryIdentifier: plan.data.url ? CATEGORIES.eventWithMeeting : CATEGORIES.event,
      // iOS: アラームは集中モードを突破する「時間厳守」にする(entitlement は app.json で宣言)
      interruptionLevel: isAlarm ? "timeSensitive" : "active",
      ...(Platform.OS === "android" && isAlarm
        ? { priority: Notifications.AndroidNotificationPriority.MAX, sticky: false }
        : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: plan.fireAt,
      channelId: isAlarm ? CHANNELS.alarm : CHANNELS.reminder,
    },
  });
}

/** ログアウトしたときなど。Slotto の予定の通知をすべて取り消す */
export async function cancelAllEventNotifications(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const request of scheduled) {
    if (request.identifier.startsWith(IDENTIFIER_PREFIX)) {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }
}
