import { apiError } from "@/server/auth";
import { getBookingIcs } from "@/server/booking/ics-download";
import { internalError, rateLimited } from "@/server/booking/http";
import { RATE_LIMITS } from "@/server/booking/rate-limit";

/** 「カレンダーアプリに追加」用の .ics(確定した予約だけ) */
export async function GET(request: Request, ctx: RouteContext<"/api/public/bookings/[token]/ics">) {
  const limited = rateLimited(request, RATE_LIMITS.read);
  if (limited) return limited;
  try {
    const { token } = await ctx.params;
    const ics = await getBookingIcs(token);
    if (!ics) return apiError(404, "not_found", "確定した予約が見つかりません");
    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="slotto.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return internalError(error);
  }
}
