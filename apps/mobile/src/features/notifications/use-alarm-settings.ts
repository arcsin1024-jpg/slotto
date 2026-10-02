import { useCallback } from "react";
import { Alert } from "react-native";
import { type AlarmSourceType, useEventAlarm, useResetEventAlarm, useSaveEventAlarm } from "@/features/data/alarms";
import { useUpdateUserSettings, useUserSettings } from "@/features/data/profile";
import { openNotificationSettings, requestNotificationPermission } from "./permissions";
import { DEFAULT_PLAN_DEFAULTS } from "./plan";
import { syncLocalNotifications } from "./scheduler";

/**
 * 通知を使う設定をしたときに許可を求める(理由が伝わる場面)。
 * 拒否されていたら、OS の設定を開くよう案内する。
 */
export async function ensurePermissionForAlarms(): Promise<boolean> {
  const permission = await requestNotificationPermission();
  if (permission === "granted") return true;
  if (permission === "denied") {
    Alert.alert("通知がオフになっています", "予定の通知やアラームを鳴らすには、設定で Slotto の通知を許可してください。", [
      { text: "あとで", style: "cancel" },
      { text: "設定を開く", onPress: () => void openNotificationSettings() },
    ]);
  }
  return false;
}

/** 予定ごとの通知・アラームの個別設定。無ければ全体の初期値 */
export function useEventAlarmSettings(sourceType: AlarmSourceType, sourceId: string) {
  const override = useEventAlarm(sourceType, sourceId);
  const settings = useUserSettings();
  const save = useSaveEventAlarm();
  const reset = useResetEventAlarm();

  const defaults = {
    notifyMinutes: settings.data?.notify_minutes ?? DEFAULT_PLAN_DEFAULTS.notifyMinutes,
    alarmMinutes: settings.data?.alarm_minutes ?? DEFAULT_PLAN_DEFAULTS.alarmMinutes,
  };
  const current = override.data
    ? {
        notifyMinutes: override.data.notify_minutes,
        alarmMinutes: override.data.alarm_minutes,
        isMuted: override.data.is_muted,
        isCustom: true,
      }
    : { ...defaults, isMuted: false, isCustom: false };

  const update = useCallback(
    async (next: { notifyMinutes: number[]; alarmMinutes: number[]; isMuted: boolean }) => {
      await save.mutateAsync({ sourceType, sourceId, ...next });
      if (!next.isMuted && next.notifyMinutes.length + next.alarmMinutes.length > 0) {
        await ensurePermissionForAlarms();
      }
      await syncLocalNotifications();
    },
    [save, sourceType, sourceId],
  );

  const resetToDefault = useCallback(async () => {
    await reset.mutateAsync({ sourceType, sourceId });
    await syncLocalNotifications();
  }, [reset, sourceType, sourceId]);

  return {
    isLoading: override.isPending || settings.isPending,
    current,
    update,
    resetToDefault,
    isSaving: save.isPending || reset.isPending,
  };
}

/** 全体の初期値(設定画面) */
export function useDefaultAlarmSettings() {
  const settings = useUserSettings();
  const updateSettings = useUpdateUserSettings();

  const update = useCallback(
    async (patch: { notify_minutes?: number[]; alarm_minutes?: number[]; notify_selected_events?: boolean }) => {
      const row = await updateSettings.mutateAsync(patch);
      if (row.notify_minutes.length + row.alarm_minutes.length > 0) await ensurePermissionForAlarms();
      await syncLocalNotifications();
    },
    [updateSettings],
  );

  return { settings, update, isSaving: updateSettings.isPending };
}
