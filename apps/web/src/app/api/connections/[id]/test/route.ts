import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { runAiTask } from "@/server/automations/ai";
import { ConnectionError, getOwnedConnection, testWebhookConnection } from "@/server/automations/connections";

/**
 * 接続先の動作確認。Webhook は署名付きの { type: "connection.test" } を送り、AI は短い応答を返させる。
 * 応答の本文は返さない(内部の探索に悪用されないよう、ステータスだけ)。
 */

export const maxDuration = 60;

export async function POST(request: Request, ctx: RouteContext<"/api/connections/[id]/test">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  try {
    const row = await getOwnedConnection(user.id, id);

    if (row.kind === "webhook") {
      const result = await testWebhookConnection(user.id, id);
      return Response.json({ ok: result.ok, status: result.status, duration_ms: result.durationMs, error: result.error ?? null });
    }

    const result = await runAiTask({ userId: user.id, connectionId: id, prompt: "動作確認です。「OK」とだけ返してください。" });
    if (result.status === "success") return Response.json({ ok: true, model: result.model, error: null });
    return Response.json({ ok: false, error: result.status === "failed" ? result.error : result.reason });
  } catch (error) {
    if (error instanceof ConnectionError) return apiError(error.code === "not_found" ? 404 : 400, error.code, error.message);
    console.error("[connections] 動作確認に失敗しました", error);
    return apiError(500, "internal", "動作確認ができませんでした");
  }
}
