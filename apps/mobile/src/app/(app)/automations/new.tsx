import { AUTOMATION_TEMPLATES } from "@slotto/core";
import { router } from "expo-router";
import { Alert } from "react-native";
import { Body, Heading, Row, Screen } from "@/components/basic";
import { useSaveAutomation } from "@/features/data/automations";
import { ensurePermissionForAlarms } from "@/features/notifications/use-alarm-settings";

/**
 * オートメーションを作る。仮の画面: いまはテンプレートから作るだけ。
 * 「いつ」→「何をする」の組み立ては、デザインが決まってから作る。
 */
export default function NewAutomationScreen() {
  const save = useSaveAutomation();

  function create(templateId: string) {
    const template = AUTOMATION_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    save.mutate(
      { input: template.input },
      {
        onSuccess: async (automation) => {
          // 結果は通知で届くので、このタイミングで許可を求める
          await ensurePermissionForAlarms();
          router.replace({ pathname: "/automations/[id]", params: { id: automation.id } });
        },
        onError: (error) => Alert.alert("作れませんでした", error.message),
      },
    );
  }

  return (
    <Screen>
      <Heading>テンプレートから作る</Heading>
      {AUTOMATION_TEMPLATES.map((template) => (
        <Row key={template.id} title={template.name} subtitle={template.description} onPress={() => create(template.id)} />
      ))}
      <Body muted>自分で組み立てる画面は、デザインが決まってから作ります。</Body>
    </Screen>
  );
}
