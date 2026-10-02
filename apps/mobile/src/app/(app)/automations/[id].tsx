import { AUTOMATION_ACTION_LABELS, AUTOMATION_TRIGGER_LABELS, formatLeadTime } from "@slotto/core";
import { router, useLocalSearchParams } from "expo-router";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { Body, Button, Card, ErrorText, Heading, Loading, Screen } from "@/components/basic";
import {
  type Automation,
  useAutomation,
  useDeleteAutomation,
  useSetAutomationEnabled,
  useTestAutomation,
} from "@/features/data/automations";
import { RunRows } from "@/features/automations/run-rows";
import { space } from "@/theme";

function triggerText(trigger: NonNullable<Automation["trigger"]>): string {
  switch (trigger.type) {
    case "before_start":
      return `開始の ${formatLeadTime(trigger.offset_minutes)}`;
    case "after_end":
      return trigger.offset_minutes === 0 ? "終了時刻" : `終了の ${trigger.offset_minutes} 分後`;
    case "daily":
      return `毎日 ${trigger.time}`;
    default:
      return AUTOMATION_TRIGGER_LABELS[trigger.type];
  }
}

/** オートメーションの詳細。仮の画面(編集はデザインが決まってから) */
export default function AutomationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const automation = useAutomation(id);
  const setEnabled = useSetAutomationEnabled();
  const test = useTestAutomation();
  const remove = useDeleteAutomation();

  if (automation.isPending) return <Loading />;
  if (automation.error) return <Screen><ErrorText error={automation.error} /></Screen>;
  const a = automation.data;

  return (
    <Screen refreshing={automation.isRefetching} onRefresh={() => void automation.refetch()}>
      <Heading>{a.name}</Heading>
      <View style={styles.row}>
        <Body muted>{a.is_enabled ? "オン" : "オフ"}</Body>
        <Switch value={a.is_enabled} onValueChange={(isEnabled) => setEnabled.mutate({ id: a.id, isEnabled })} />
      </View>
      <Card>
        <Body muted>いつ</Body>
        <Body>{a.trigger ? triggerText(a.trigger) : "(読み込めない設定です)"}</Body>
        <Body muted>何をする</Body>
        {a.actions?.map((action, index) => <Body key={index}>{AUTOMATION_ACTION_LABELS[action.type]}</Body>)}
      </Card>
      <Button
        label="試しに実行"
        variant="secondary"
        loading={test.isPending}
        onPress={() =>
          test.mutate(a.id, {
            onSuccess: () => Alert.alert("実行しました", "結果は実行履歴と通知で届きます。"),
            onError: (error) => Alert.alert("実行できませんでした", error.message),
          })
        }
      />
      <Heading>実行履歴</Heading>
      <RunRows automationId={a.id} />
      <Button
        label="削除"
        variant="danger"
        loading={remove.isPending}
        onPress={() =>
          Alert.alert("削除しますか?", undefined, [
            { text: "やめる", style: "cancel" },
            {
              text: "削除する",
              style: "destructive",
              onPress: () => remove.mutate(a.id, { onSuccess: () => router.back() }),
            },
          ])
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2] },
});
