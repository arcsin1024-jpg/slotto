import { formatLeadTime } from "@slotto/core";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { Body, Button, Card, Heading, Loading, Screen } from "@/components/basic";
import { syncLocalNotifications } from "@/features/notifications/scheduler";
import { useDefaultAlarmSettings } from "@/features/notifications/use-alarm-settings";
import { space } from "@/theme";

const NOTIFY_CHOICES = [[], [5], [10], [30], [10, 60]] as const;
const ALARM_CHOICES = [[], [0], [5], [10]] as const;

function label(minutes: readonly number[]): string {
  return minutes.length === 0 ? "なし" : minutes.map(formatLeadTime).join("・");
}

/** 通知とアラームの初期値。仮の画面 */
export default function NotificationSettingsScreen() {
  const { settings, update, isSaving } = useDefaultAlarmSettings();
  if (settings.isPending) return <Loading />;

  const notifyMinutes = settings.data?.notify_minutes ?? [10];
  const alarmMinutes = settings.data?.alarm_minutes ?? [];
  const run = (patch: Parameters<typeof update>[0]) =>
    update(patch).catch((error: unknown) =>
      Alert.alert("保存できませんでした", error instanceof Error ? error.message : undefined),
    );

  return (
    <Screen>
      <Card>
        <Heading>通知</Heading>
        <Body muted>いまの設定: {label(notifyMinutes)}</Body>
        <View style={styles.choices}>
          {NOTIFY_CHOICES.map((minutes) => (
            <Button key={`n${minutes.join(",")}`} label={label(minutes)} variant="secondary" disabled={isSaving}
              onPress={() => run({ notify_minutes: [...minutes] })} />
          ))}
        </View>
      </Card>
      <Card>
        <Heading>アラーム</Heading>
        <Body muted>いまの設定: {label(alarmMinutes)}</Body>
        <View style={styles.choices}>
          {ALARM_CHOICES.map((minutes) => (
            <Button key={`a${minutes.join(",")}`} label={label(minutes)} variant="secondary" disabled={isSaving}
              onPress={() => run({ alarm_minutes: [...minutes] })} />
          ))}
        </View>
        <Body muted>
          iPhone はマナーモードではアラームの音が鳴りません。Android は「アラームとリマインダー」を許可すると時刻どおりに鳴ります。
        </Body>
      </Card>
      <View style={styles.row}>
        <Body>反映中の外部予定も知らせる</Body>
        <Switch
          value={settings.data?.notify_selected_events ?? true}
          disabled={isSaving}
          onValueChange={(value) => run({ notify_selected_events: value })}
        />
      </View>
      <Button
        label="通知を張り直す"
        variant="secondary"
        onPress={async () => {
          const result = await syncLocalNotifications();
          Alert.alert(
            result.status === "synced"
              ? `予約しました(新しく ${result.scheduled} 件、取り消し ${result.cancelled} 件)`
              : result.status === "no_permission"
                ? "通知が許可されていません"
                : "張り直せませんでした",
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  choices: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] },
});
