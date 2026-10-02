import { apiError } from "@/server/auth";
import { getPublicBooking } from "@/server/booking";
import { internalError, rateLimited } from "@/server/booking/http";
import { RATE_LIMITS } from "@/server/booking/rate-limit";

/** 予約の確認(ゲスト用の管理トークンで読む) */
export async function GET(request: Request, ctx: RouteContext<"/api/public/bookings/[token]">) {
  const limited = rateLimited(request, RATE_LIMITS.read);
  if (limited) return limited;
  try {
    const { token } = await ctx.params;
    const booking = await getPublicBooking(token);
    if (!booking) return apiError(404, "not_found", "予約が見つかりません");
    return Response.json({ booking });
  } catch (error) {
    return internalError(error);
  }
}
