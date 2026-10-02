import { cancelBookingInputSchema } from "@slotto/core";
import { getApiUser, unauthorized } from "@/server/auth";
import { declineBooking } from "@/server/booking";
import { bookingFailure, internalError, readJson } from "@/server/booking/http";

/** ホストが予約を辞退する。本文: { reason?: string } */
export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[id]/decline">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const input = await readJson(request, cancelBookingInputSchema);
  if (!input.ok) return input.response;
  try {
    const { id } = await ctx.params;
    const result = await declineBooking(user.id, id, input.data.reason);
    if (!result.ok) return bookingFailure(result);
    return Response.json({ booking: result.booking });
  } catch (error) {
    return internalError(error);
  }
}
