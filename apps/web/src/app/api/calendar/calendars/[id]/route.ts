import { z } from "zod";
import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { updateCalendarSettings } from "@/server/calendar/connections";

const inputSchema = z
  .object({ is_enabled: z.boolean().optional(), auto_select_new: z.boolean().optional() })
  .refine((v) => v.is_enabled !== undefined || v.auto_select_new !== undefined);

/**
 * カレンダーごとの設定を変える。本文 { is_enabled?, auto_select_new? }
 * 表示をオフにすると、そのカレンダーの予定は消え、空き時間の計算からも外れる。
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/calendar/calendars/[id]">) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const { id } = await ctx.params;

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_input", "入力が正しくありません");

  const calendar = await updateCalendarSettings(user.id, id, parsed.data);
  if (!calendar) return apiError(404, "not_found", "カレンダーが見つかりません");
  return Response.json({ calendar });
}
