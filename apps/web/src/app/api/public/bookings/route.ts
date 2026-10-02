import { createBookingInputSchema } from "@slotto/core";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBooking, toPublicBooking } from "@/server/booking";
import { bookingFailure, internalError, rateLimited, readJson } from "@/server/booking/http";
import { RATE_LIMITS } from "@/server/booking/rate-limit";

/** ゲストの予約の作成 */
export async function POST(request: Request) {
  const limited = rateLimited(request, RATE_LIMITS.write);
  if (limited) return limited;
  const input = await readJson(request, createBookingInputSchema);
  if (!input.ok) return input.response;
  try {
    const result = await createBooking(input.data);
    if (!result.ok) return bookingFailure(result);
    return Response.json({ booking: await toPublicBooking(createAdminClient(), result.booking) }, { status: 201 });
  } catch (error) {
    return internalError(error);
  }
}
