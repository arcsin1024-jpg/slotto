import { Screen } from "@/components/basic";
import { RunRows } from "@/features/automations/run-rows";

/** すべてのオートメーションの実行履歴。仮の画面 */
export default function RunsScreen() {
  return (
    <Screen>
      <RunRows automationId={null} />
    </Screen>
  );
}
