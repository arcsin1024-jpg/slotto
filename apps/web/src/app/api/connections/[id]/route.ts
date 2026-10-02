import { apiError, getApiUser, unauthorized } from "@/server/auth";
import {
  apiConnectionUpdateSchema,
  ConnectionError,
  deleteConnection,
  updateConnection,
} from "@/server/automations/connections";

/**
 * 接続先の更新と削除。
 * PATCH: { name?, config?, secret?, rotate_secret? }。rotate_secret で Webhook の署名の値を作り直したときだけ signing_secret を返す
 */

function failure(error: unknown) {
  if (error instanceof ConnectionError) return apiError(error.code === "not_found" ? 404 : 400, error.code, error.message);
  console.error("[connections] 失敗しました", error);
  return apiError(500, "internal", "接続先を更新できませんでした");
}

export async function PATCH(request: Request, ctx: RouteContext<"/api/connections/[id]">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const parsed = apiConnectionUpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid", parsed.error.issues[0]?.message ?? "入力が正しくありません");

  try {
    const { connection, signingSecret } = await updateConnection(user.id, id, parsed.data);
    return Response.json({ connection, ...(signingSecret ? { signing_secret: signingSecret } : {}) });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, ctx: RouteContext<"/api/connections/[id]">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;
  try {
    await deleteConnection(user.id, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return failure(error);
  }
}
