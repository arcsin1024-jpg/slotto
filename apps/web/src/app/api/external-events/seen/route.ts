import { z } from "zod";
import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { markEventsSeen } from "@/server/calendar";

const inputSchema = z.object({ event_ids: z.array(z.uuid()).min(1).max(1000).optional() });

/** 取り込み画面で見た予定に印を付ける(「未選択の新着」から外す)。本文 { event_ids? }。省くとすべて */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, "invalid_input", "入力が正しくありません");

  const count = await markEventsSeen(user.id, parsed.data.event_ids);
  return Response.json({ count });
}
