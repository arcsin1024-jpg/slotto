import { getApiUser, unauthorized } from "@/server/auth";
import { approveBooking } from "@/server/booking";
import { bookingFailure, internalError } from "@/server/booking/http";

/** ホストが予約を承認する(Web の Cookie か、アプリの Bearer トークン) */
export async function POST(request: Request, ctx: RouteContext<"/api/bookings/[id]/approve">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  try {
    const { id } = await ctx.params;
    const result = await approveBooking(user.id, id);
    if (!result.ok) return bookingFailure(result);
    return Response.json({ booking: result.booking });
  } catch (error) {
    return internalError(error);
  }
}
