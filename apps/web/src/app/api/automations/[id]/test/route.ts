import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { AutomationTestError, runAutomationTest } from "@/server/automations";

/**
 * オートメーションの試し実行。対象に当たる直近の予定(無ければ見本の予定)で、すべてのアクションを実際に動かす。
 * 応答は実行履歴の 1 行(automation_runs)。オフのオートメーションでも動く。
 */

export const maxDuration = 60;

export async function POST(request: Request, ctx: RouteContext<"/api/automations/[id]/test">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  try {
    const run = await runAutomationTest(user.id, id);
    return Response.json({ run });
  } catch (error) {
    if (error instanceof AutomationTestError) {
      const status = error.code === "not_found" ? 404 : error.code === "too_many" ? 429 : 400;
      return apiError(status, error.code, error.message);
    }
    console.error("[automations] 試し実行に失敗しました", error);
    return apiError(500, "internal", "試し実行ができませんでした");
  }
}
