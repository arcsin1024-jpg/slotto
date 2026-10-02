import { AUTOMATION_ACTION_LABELS, AUTOMATION_TRIGGER_LABELS } from "@slotto/core";
import { router } from "expo-router";
import { Switch } from "react-native";
import { Body, Button, ErrorText, Heading, Loading, Row, Screen } from "@/components/basic";
import { type Automation, useAutomations, useSetAutomationEnabled } from "@/features/data/automations";

function summary(automation: Automation): string {
  const trigger = automation.trigger ? AUTOMATION_TRIGGER_LABELS[automation.trigger.type] : "?";
  const actions = automation.actions?.map((action) => AUTOMATION_ACTION_LABELS[action.type]).join("、") ?? "?";
  return `${trigger} → ${actions}`;
}

// 仮の画面。デザインが決まったら作り直す
export default function AutomationsScreen() {
  const automations = useAutomations();
  const setEnabled = useSetAutomationEnabled();

  return (
    <Screen tab refreshing={automations.isRefetching} onRefresh={() => void automations.refetch()}>
      <Heading>オートメーション</Heading>
      <Button label="新しく作る" onPress={() => router.push("/automations/new")} />
      {automations.isPending ? (
        <Loading />
      ) : automations.error ? (
        <ErrorText error={automations.error} />
      ) : automations.data.length === 0 ? (
        <Body muted>まだありません。テンプレートから作れます。</Body>
      ) : (
        automations.data.map((automation) => (
          <Row
            key={automation.id}
            title={automation.name}
            subtitle={summary(automation)}
            onPress={() => router.push({ pathname: "/automations/[id]", params: { id: automation.id } })}
            right={
              <Switch
                value={automation.is_enabled}
                onValueChange={(isEnabled) => setEnabled.mutate({ id: automation.id, isEnabled })}
              />
            }
          />
        ))
      )}
      <Row title="実行履歴" onPress={() => router.push("/runs")} />
      <Row title="接続先(Webhook、AI)" onPress={() => router.push("/connections")} />
    </Screen>
  );
}
