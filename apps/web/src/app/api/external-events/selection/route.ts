import { eventSelectionInputSchema } from "@slotto/core";
import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { applyEventSelection } from "@/server/calendar";

/**
 * 外部予定の選択・解除(複数件)。本文は eventSelectionInputSchema。
 * apply_to_series: true のときは繰り返しの「今後すべて」として、指定した回以降をまとめて変える。
 * 返すのは状態が変わった予定の一覧。
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const parsed = eventSelectionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input", "入力が正しくありません");

  const events = await applyEventSelection(user.id, parsed.data);
  return Response.json({ events });
}
