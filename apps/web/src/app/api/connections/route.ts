import { apiConnectionInputSchema } from "@slotto/core";
import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { ConnectionError, createConnection, listConnections } from "@/server/automations/connections";

/**
 * 接続先(Webhook、AI)の一覧と登録。秘密の値は暗号化して保存し、返さない。
 * Webhook で署名の値を省いたときは Slotto が作り、作った直後の応答の signing_secret で 1 回だけ返す。
 */

export async function GET(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  return Response.json({ connections: await listConnections(user.id) });
}

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const parsed = apiConnectionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid", parsed.error.issues[0]?.message ?? "入力が正しくありません");

  try {
    const { connection, signingSecret } = await createConnection(user.id, parsed.data);
    return Response.json({ connection, ...(signingSecret ? { signing_secret: signingSecret } : {}) }, { status: 201 });
  } catch (error) {
    if (error instanceof ConnectionError) return apiError(error.code === "not_found" ? 404 : 400, error.code, error.message);
    console.error("[connections] 登録に失敗しました", error);
    return apiError(500, "internal", "接続先を登録できませんでした");
  }
}
