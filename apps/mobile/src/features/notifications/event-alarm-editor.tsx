import { formatLeadTime } from "@slotto/core";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { Body, Button, Card } from "@/components/basic";
import type { AlarmSourceType } from "@/features/data/alarms";
import { space } from "@/theme";
import { useEventAlarmSettings } from "./use-alarm-settings";

const NOTIFY_CHOICES = [[], [10], [30], [10, 60]] as const;
const ALARM_CHOICES = [[], [0], [5]] as const;

function label(minutes: readonly number[]): string {
  return minutes.length === 0 ? "なし" : minutes.map(formatLeadTime).join("・");
}

// 仮の部品。デザインが決まったら作り直す
export function EventAlarmEditor({ sourceType, sourceId }: { sourceType: AlarmSourceType; sourceId: string }) {
  const { isLoading, current, update, resetToDefault, isSaving } = useEventAlarmSettings(sourceType, sourceId);
  if (isLoading) return null;

  const run = (action: () => Promise<void>) =>
    action().catch((error: unknown) =>
      Alert.alert("保存できませんでした", error instanceof Error ? error.message : undefined),
    );

  return (
    <Card>
      <Body>通知とアラーム{current.isCustom ? "(この予定だけ)" : "(初期値)"}</Body>
      <View style={styles.row}>
        <Body muted>この予定は鳴らさない</Body>
        <Switch
          value={current.isMuted}
          disabled={isSaving}
          onValueChange={(isMuted) => run(() => update({ ...current, isMuted }))}
        />
      </View>
      <Body muted>通知: {label(current.notifyMinutes)}</Body>
      <View style={styles.choices}>
        {NOTIFY_CHOICES.map((minutes) => (
          <Button key={`n${minutes.join(",")}`} label={label(minutes)} variant="secondary" disabled={isSaving}
            onPress={() => run(() => update({ ...current, notifyMinutes: [...minutes] }))} />
        ))}
      </View>
      <Body muted>アラーム: {label(current.alarmMinutes)}</Body>
      <View style={styles.choices}>
        {ALARM_CHOICES.map((minutes) => (
          <Button key={`a${minutes.join(",")}`} label={label(minutes)} variant="secondary" disabled={isSaving}
            onPress={() => run(() => update({ ...current, alarmMinutes: [...minutes] }))} />
        ))}
      </View>
      {current.isCustom ? (
        <Button label="初期値に戻す" variant="secondary" disabled={isSaving} onPress={() => run(resetToDefault)} />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
});
