import { apiError } from "@/server/auth";
import { getPublicSlots } from "@/server/booking";
import { internalError, rateLimited } from "@/server/booking/http";
import { RATE_LIMITS } from "@/server/booking/rate-limit";

function parseDate(value: string | null): Date | undefined | null {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * 空き枠。クエリ:
 * - from / to: 期間(ISO 8601)。省略すると今から受付期限まで。最長 62 日
 * - reschedule: 日程変更するときの元の予約のトークン。その予約の時間も空きとして出す
 */
export async function GET(request: Request, ctx: RouteContext<"/api/public/pages/[username]/[slug]/slots">) {
  const limited = rateLimited(request, RATE_LIMITS.read);
  if (limited) return limited;
  try {
    const { username, slug } = await ctx.params;
    const search = new URL(request.url).searchParams;
    const from = parseDate(search.get("from"));
    const to = parseDate(search.get("to"));
    if (from === null || to === null) return apiError(400, "invalid", "期間の形式が正しくありません");
    const result = await getPublicSlots(username, slug, {
      from,
      to,
      excludeToken: search.get("reschedule") ?? undefined,
    });
    if (!result) return apiError(404, "not_found", "予約ページが見つからないか、受付を停止しています");
    return Response.json(result);
  } catch (error) {
    return internalError(error);
  }
}
