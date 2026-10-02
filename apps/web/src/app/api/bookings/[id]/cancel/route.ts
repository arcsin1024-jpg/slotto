import { cancelBookingInputSchema } from "@slotto/core";
import { getApiUser, unauthorized } from "@/server/auth";
import { cancelBooking } from "@/server/booking";
import { bookingFailure, internalError, readJson } from "@/server/booking/http";

/** ホストが予約をキャンセルする。本文: { reason?: string } */
export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[id]/cancel">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const input = await readJson(request, cancelBookingInputSchema);
  if (!input.ok) return input.response;
  try {
    const { id } = await ctx.params;
    const result = await cancelBooking({ by: "host", hostId: user.id, bookingId: id }, input.data.reason);
    if (!result.ok) return bookingFailure(result);
    return Response.json({ booking: result.booking });
  } catch (error) {
    return internalError(error);
  }
}
