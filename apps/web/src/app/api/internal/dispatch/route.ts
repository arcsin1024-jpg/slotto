import { createHash, timingSafeEqual } from "node:crypto";
import { apiError } from "@/server/auth";
import { dispatchDueJobs } from "@/server/jobs/dispatch";

/**
 * 時刻が来たジョブの実行。pg_cron が毎分 pg_net で呼ぶ(supabase/migrations の invoke_job_dispatch)。
 * `Authorization: Bearer <CRON_SECRET>` で守る。
 */

export const maxDuration = 60;

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  // 長さの違いで比較の時間が変わらないよう、ハッシュどうしを比べる
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return token.length > 0 && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return apiError(503, "not_configured", "CRON_SECRET が設定されていません");
  if (!authorized(request, secret)) return apiError(401, "unauthorized", "認証に失敗しました");

  try {
    const summary = await dispatchDueJobs();
    return Response.json(summary);
  } catch (error) {
    console.error("[jobs] dispatch が失敗しました", error);
    return apiError(500, "dispatch_failed", "ジョブの実行に失敗しました");
  }
}
