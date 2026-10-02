import { rescheduleBookingInputSchema } from "@slotto/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { rescheduleBooking, toPublicBooking } from "@/server/booking";
import { bookingFailure, internalError, rateLimited, readJson } from "@/server/booking/http";
import { RATE_LIMITS } from "@/server/booking/rate-limit";

/** ゲストによる日程変更。新しい予約(新しいトークン)を返す */
export async function POST(request: Request, ctx: RouteContext<"/api/public/bookings/[token]/reschedule">) {
  const limited = rateLimited(request, RATE_LIMITS.write);
  if (limited) return limited;
  const input = await readJson(request, rescheduleBookingInputSchema);
  if (!input.ok) return input.response;
  try {
    const { token } = await ctx.params;
    const result = await rescheduleBooking(token, input.data.starts_at);
    if (!result.ok) return bookingFailure(result);
    return Response.json({ booking: await toPublicBooking(createAdminClient(), result.booking) }, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
