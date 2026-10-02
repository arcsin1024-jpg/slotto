import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { disconnectConnection } from "@/server/calendar/connections";

/** 外部カレンダーの連携を解除する。Google 側の許可も取り消し、取り込んだ予定も消す */
export async function DELETE(request: Request, ctx: RouteContext<"/api/calendar/connections/[id]">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const removed = await disconnectConnection(user.id, id);
  if (!removed) return apiError(404, "not_found", "接続が見つかりません");
  return Response.json({ ok: true });
}
