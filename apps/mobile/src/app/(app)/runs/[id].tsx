import { AUTOMATION_ACTION_LABELS, formatDate, formatTime } from "@slotto/core";
import { useLocalSearchParams } from "expo-router";
import { Body, Card, ErrorText, Heading, Loading, Screen } from "@/components/basic";
import { RUN_STATUS_LABELS } from "@/features/automations/run-rows";
import { useAutomationRun } from "@/features/data/automations";
import { useTimeZone } from "@/features/data/profile";

/**
 * 実行結果(AI の出力など)。オートメーションの結果の通知をタップすると開く。仮の画面。
 * 予定の時刻(scheduled_for)と、実際に終わった時刻(finished_at)は別に表示する。
 */
export default function RunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const timeZone = useTimeZone();
  const run = useAutomationRun(id);

  if (run.isPending) return <Loading />;
  if (run.error) return <Screen><ErrorText error={run.error} /></Screen>;
  const r = run.data;
  const at = (value: string) => `${formatDate(value, timeZone)} ${formatTime(value, timeZone)}`;

  return (
    <Screen refreshing={run.isRefetching} onRefresh={() => void run.refetch()}>
      <Heading>{RUN_STATUS_LABELS[r.status]}</Heading>
      <Body muted>予定: {at(r.scheduled_for)}</Body>
      {r.finished_at ? <Body muted>完了: {at(r.finished_at)}</Body> : null}
      {r.error ? <Body>{r.error}</Body> : null}
      {r.results.map((result, index) => (
        <Card key={index}>
          <Body>
            {AUTOMATION_ACTION_LABELS[result.type]} ・ {result.status}
          </Body>
          {result.summary ? <Body muted>{result.summary}</Body> : null}
          {result.output ? <Body selectable>{result.output}</Body> : null}
          {result.error ? <Body muted>{result.error}</Body> : null}
        </Card>
      ))}
    </Screen>
  );
}
