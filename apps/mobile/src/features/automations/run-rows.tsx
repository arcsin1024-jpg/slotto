import { formatDate, formatTime } from "@slotto/core";
import { router } from "expo-router";
import { Body, ErrorText, Loading, Row } from "@/components/basic";
import { type AutomationRun, useAutomationRuns } from "@/features/data/automations";
import { useTimeZone } from "@/features/data/profile";

export const RUN_STATUS_LABELS: Record<AutomationRun["status"], string> = {
  pending: "待機中",
  running: "実行中",
  success: "成功",
  failed: "失敗",
  skipped: "スキップ",
};

/** 実行履歴の行。automationId が null なら全部。仮の部品 */
export function RunRows({ automationId }: { automationId: string | null }) {
  const timeZone = useTimeZone();
  const runs = useAutomationRuns(automationId);

  if (runs.isPending) return <Loading />;
  if (runs.error) return <ErrorText error={runs.error} />;
  if (runs.data.length === 0) return <Body muted>まだ実行されていません</Body>;
  return runs.data.map((run) => (
    <Row
      key={run.id}
      title={`${RUN_STATUS_LABELS[run.status]} ・ ${formatDate(run.scheduled_for, timeZone)} ${formatTime(run.scheduled_for, timeZone)}`}
      subtitle={run.error ?? run.results.map((result) => result.summary).filter(Boolean).join(" / ")}
      onPress={() => router.push({ pathname: "/runs/[id]", params: { id: run.id } })}
    />
  ));
}
