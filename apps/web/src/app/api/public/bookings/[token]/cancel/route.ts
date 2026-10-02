import { cancelBookingInputSchema } from "@slotto/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelBooking, toPublicBooking } from "@/server/booking";
import { bookingFailure, internalError, rateLimited, readJson } from "@/server/booking/http";
import { RATE_LIMITS } from "@/server/booking/rate-limit";

/** ゲストによるキャンセル */
export async function POST(request: Request, ctx: RouteContext<"/api/public/bookings/[token]/cancel">) {
  const limited = rateLimited(request, RATE_LIMITS.write);
  if (limited) return limited;
  const input = await readJson(request, cancelBookingInputSchema);
  if (!input.ok) return input.response;
  try {
    const { token } = await ctx.params;
    const result = await cancelBooking({ by: "guest", token }, input.data.reason);
    if (!result.ok) return bookingFailure(result);
    return Response.json({ booking: await toPublicBooking(createAdminClient(), result.booking) });
  } catch (error) {
    return internalError(error);
  }
}
