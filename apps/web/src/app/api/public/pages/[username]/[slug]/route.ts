import { apiError } from "@/server/auth";
import { getPublicPage } from "@/server/booking";
import { internalError, rateLimited } from "@/server/booking/http";
import { RATE_LIMITS } from "@/server/booking/rate-limit";

/** 予約ページの公開情報 */
export async function GET(request: Request, ctx: RouteContext<"/api/public/pages/[username]/[slug]">) {
  const limited = rateLimited(request, RATE_LIMITS.read);
  if (limited) return limited;
  try {
    const { username, slug } = await ctx.params;
    const result = await getPublicPage(username, slug);
    if (!result) return apiError(404, "not_found", "予約ページが見つからないか、受付を停止しています");
    return Response.json(result);
  } catch (error) {
    return internalError(error);
  }
}
