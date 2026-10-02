import "server-only";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, type LanguageModel } from "ai";
import { serverEnv } from "@/lib/env";
import { getConnectionForUse, touchConnection } from "./connections";
import { AI_INSTRUCTIONS } from "./prompt";

/**
 * 「AI に実行させる」アクション。AI SDK で呼ぶ。
 * - connection_id が null なら Slotto の内蔵 AI(Vercel AI Gateway)、値があればユーザーの API キー
 * - 予定の内容(タイトル、ゲストの回答など)は第三者が書ける。指示文の差し込みは JSON の文字列にして埋め、
 *   予定の情報は「参照データ」として分けて渡し、指示として扱わないようシステムの指示で明示する
 * - AI にはツールを渡さない(読むだけ + 本人への通知だけ)。出力はテキストとして扱い、HTML として描画しない
 */

/** 内蔵 AI の既定のモデル(AI Gateway の ID)。AI_DEFAULT_MODEL で差し替えられる */
export const DEFAULT_GATEWAY_MODEL = "anthropic/claude-sonnet-5.5";

const MAX_OUTPUT_TOKENS = 1200;
const TIMEOUT_MS = 60_000;

export type AiTaskResult =
  | { status: "success"; text: string; model: string; inputTokens?: number; outputTokens?: number }
  | { status: "not_configured"; reason: string }
  | { status: "failed"; error: string };

function gatewayConfigured(): boolean {
  return Boolean(serverEnv.aiGatewayApiKey || process.env.VERCEL_OIDC_TOKEN);
}

async function resolveModel(
  userId: string,
  connectionId: string | null,
): Promise<{ model: LanguageModel; label: string } | { notConfigured: string }> {
  if (!connectionId) {
    if (!gatewayConfigured()) return { notConfigured: "設定が必要です: 内蔵 AI(AI_GATEWAY_API_KEY が未設定)" };
    const id = process.env.AI_DEFAULT_MODEL || DEFAULT_GATEWAY_MODEL;
    return { model: id, label: id };
  }
  const { config, secret } = await getConnectionForUse(userId, connectionId, "ai");
  if (!secret) return { notConfigured: "設定が必要です: 接続先に API キーがありません" };
  await touchConnection(connectionId);
  if (config.provider === "anthropic") {
    return { model: createAnthropic({ apiKey: secret })(config.model), label: `anthropic/${config.model}` };
  }
  return { model: createOpenAI({ apiKey: secret })(config.model), label: `openai/${config.model}` };
}

export async function runAiTask(input: {
  userId: string;
  connectionId: string | null;
  prompt: string;
}): Promise<AiTaskResult> {
  let resolved: Awaited<ReturnType<typeof resolveModel>>;
  try {
    resolved = await resolveModel(input.userId, input.connectionId);
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : "接続先を読めません" };
  }
  if ("notConfigured" in resolved) return { status: "not_configured", reason: resolved.notConfigured };

  try {
    const result = await generateText({
      model: resolved.model,
      instructions: AI_INSTRUCTIONS,
      prompt: input.prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      maxRetries: 1,
      timeout: TIMEOUT_MS,
    });
    if (result.finishReason === "content-filter") return { status: "failed", error: "AI が応答を断りました" };
    if (result.finishReason === "length") return { status: "failed", error: "出力が長すぎて途中で止まりました" };
    const text = result.text.trim();
    if (result.finishReason !== "stop" || !text) return { status: "failed", error: `AI の応答が空でした(${result.finishReason})` };
    return {
      status: "success",
      text,
      model: resolved.label,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
    };
  } catch (error) {
    // 応答の本文やヘッダには秘密が含まれうるので、メッセージの先頭だけを残す
    const message = error instanceof Error ? error.message.slice(0, 200) : "不明なエラー";
    return { status: "failed", error: `AI の呼び出しに失敗しました: ${message}` };
  }
}
