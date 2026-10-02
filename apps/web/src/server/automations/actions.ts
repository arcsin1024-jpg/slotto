import "server-only";
import type { AutomationAction, AutomationActionResult, AutomationTrigger } from "@slotto/core";
import { sendPush, type PushResult } from "@/server/push";
import { runAiTask } from "./ai";
import { ConnectionError, getConnectionForUse, touchConnection } from "./connections";
import { buildAiPrompt } from "./prompt";
import { expandTemplate, truncate, type EventDetails, type TemplateVariables } from "./template";
import { webhookIdFor } from "./webhook/signature";
import { deliverWebhook } from "./webhook/deliver";

/** アクション 1 つずつの実行。失敗は投げずに結果として返す(履歴に残す) */

export interface ActionContext {
  userId: string;
  automation: { id: string; name: string; trigger: AutomationTrigger };
  /** 対象の予定。毎日のオートメーションでは null */
  event: EventDetails | null;
  /** 毎日のオートメーションの、その日の予定 */
  agenda: EventDetails[] | null;
  variables: TemplateVariables;
  /** 実行履歴の ID(通知からアプリの履歴を開くのに使う) */
  runId: string;
  /** 再送でも変わらない、この実行の識別子(Webhook の webhook-id の元) */
  idempotencyKey: string;
  test: boolean;
}

const NOTIFICATION_BODY_MAX = 180;

function pushOutcome(type: AutomationActionResult["type"], result: PushResult, started: number): AutomationActionResult {
  const duration_ms = Date.now() - started;
  if (result.skipped === "not_configured") {
    return { type, status: "skipped", summary: "設定が必要です: プッシュ通知(EXPO_ACCESS_TOKEN が未設定)", duration_ms };
  }
  if (result.skipped === "no_devices") {
    return { type, status: "skipped", summary: "通知を受け取る端末が登録されていません", duration_ms };
  }
  if (result.sent === 0) {
    return { type, status: "failed", error: `通知を送れませんでした(${result.errors?.join(", ") ?? "不明"})`, duration_ms };
  }
  return { type, status: "success", summary: `${result.sent} 台に送りました`, duration_ms };
}

function baseData(ctx: ActionContext): Record<string, unknown> {
  return {
    type: "automation",
    automation_id: ctx.automation.id,
    run_id: ctx.runId,
    ...(ctx.event ? { source_type: ctx.event.source_type, source_id: ctx.event.id } : {}),
  };
}

function safeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Webhook に送る JSON(Standard Webhooks の type / timestamp / data の形) */
export function webhookPayload(ctx: ActionContext, note: string | undefined) {
  return {
    type: ctx.test ? "automation.test" : "automation.triggered",
    timestamp: new Date().toISOString(),
    data: {
      automation: { id: ctx.automation.id, name: ctx.automation.name, trigger: ctx.automation.trigger },
      run_id: ctx.runId,
      test: ctx.test,
      event: ctx.event
        ? {
            ...ctx.event,
            answers: ctx.event.answers.map((a) => ({ label: a.label, value: truncate(a.value, 1000) })),
          }
        : null,
      ...(ctx.agenda ? { agenda: ctx.agenda.map(({ answers: _answers, ...rest }) => rest) } : {}),
      ...(note ? { note: expandTemplate(note, ctx.variables) } : {}),
    },
  };
}

export async function executeAction(action: AutomationAction, index: number, ctx: ActionContext): Promise<AutomationActionResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;
  try {
    switch (action.type) {
      case "push":
      case "alarm": {
        const title = truncate(expandTemplate(action.title, ctx.variables), 100) || ctx.automation.name;
        const body = action.type === "push" ? truncate(expandTemplate(action.body, ctx.variables), NOTIFICATION_BODY_MAX) : undefined;
        const result = await sendPush(ctx.userId, {
          title,
          ...(body ? { body } : {}),
          data: baseData(ctx),
          alarm: action.type === "alarm",
        });
        return pushOutcome(action.type, result, started);
      }

      case "open_url": {
        const url = safeUrl(expandTemplate(action.url, ctx.variables));
        if (!url) return { type: "open_url", status: "skipped", summary: "開く URL がありません", duration_ms: elapsed() };
        const title = truncate(expandTemplate(action.title, ctx.variables), 100) || ctx.automation.name;
        const result = await sendPush(ctx.userId, {
          title,
          body: "タップして開きます",
          data: { ...baseData(ctx), type: "open_url", url },
        });
        return pushOutcome("open_url", result, started);
      }

      case "webhook": {
        const { config, secret } = await getConnectionForUse(ctx.userId, action.connection_id, "webhook");
        if (!secret) return { type: "webhook", status: "failed", error: "署名の秘密の値がありません。接続先を登録し直してください", duration_ms: elapsed() };
        const result = await deliverWebhook({
          url: config.url,
          method: config.method,
          secret,
          webhookId: webhookIdFor(`${ctx.idempotencyKey}:${index}`),
          payload: webhookPayload(ctx, action.note),
        });
        await touchConnection(action.connection_id);
        const host = new URL(config.url).host;
        return result.ok
          ? { type: "webhook", status: "success", summary: `${host} が HTTP ${result.status} を返しました`, duration_ms: result.durationMs }
          : { type: "webhook", status: "failed", error: `${host}: ${result.error ?? "失敗しました"}`, duration_ms: result.durationMs };
      }

      case "ai_task": {
        const prompt = buildAiPrompt(action.prompt, ctx.variables, { event: ctx.event, agenda: ctx.agenda });
        const ai = await runAiTask({ userId: ctx.userId, connectionId: action.connection_id, prompt });
        if (ai.status === "not_configured") return { type: "ai_task", status: "skipped", summary: ai.reason, duration_ms: elapsed() };
        if (ai.status === "failed") return { type: "ai_task", status: "failed", error: ai.error, duration_ms: elapsed() };

        const result: AutomationActionResult = {
          type: "ai_task",
          status: "success",
          summary: truncate(ai.text.replace(/\s+/g, " "), 200),
          output: ai.text,
          duration_ms: elapsed(),
        };
        if (action.deliver === "push") {
          // 宛先は本人に固定。「AI が作成」と分かるようにする
          const push = await sendPush(ctx.userId, {
            title: truncate(`AI: ${ctx.automation.name}`, 100),
            body: truncate(ai.text, NOTIFICATION_BODY_MAX),
            data: { ...baseData(ctx), ai: true },
          });
          if (push.sent === 0) {
            const outcome = pushOutcome("ai_task", push, started);
            result.summary = `${result.summary}(通知: ${outcome.summary ?? outcome.error})`;
          }
        }
        return result;
      }
    }
  } catch (error) {
    if (error instanceof ConnectionError) return { type: action.type, status: "failed", error: error.message, duration_ms: elapsed() };
    console.error(`[automations] アクション ${action.type} が失敗しました`, error);
    return { type: action.type, status: "failed", error: "実行中にエラーが起きました", duration_ms: elapsed() };
  }
}
