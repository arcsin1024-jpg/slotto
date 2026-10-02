import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { GoogleReauthRequiredError, syncConnection } from "@/server/calendar";
import { errorMessage } from "@/server/calendar/schedule";
import { afterSync } from "@/server/calendar/sync";

const inputSchema = z.object({ connection_id: z.uuid().optional() });

/**
 * 外部カレンダーを今すぐ同期する。本文 { connection_id? }。省くと自分の Google の接続すべて。
 * 結果は接続ごとに返す。連携が切れていれば status が "needs_reauth" になる。
 */
export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();

  const parsed = inputSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return apiError(400, "invalid_input", "入力が正しくありません");

  let query = createAdminClient()
    .from("calendar_connections")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("provider", "google");
  if (parsed.data.connection_id) query = query.eq("id", parsed.data.connection_id);
  const { data: connections, error } = await query;
  if (error) return apiError(500, "db_error", "接続の読み込みに失敗しました");
  if (parsed.data.connection_id && !connections?.length) return apiError(404, "not_found", "接続が見つかりません");

  const results = [];
  for (const connection of connections ?? []) {
    if (connection.status !== "active") {
      results.push({ connection_id: connection.id, status: connection.status });
      continue;
    }
    try {
      const counts = await syncConnection(connection.id);
      await afterSync(connection.id, user.id);
      results.push({ connection_id: connection.id, status: "active", ...counts });
    } catch (e) {
      if (e instanceof GoogleReauthRequiredError) {
        results.push({ connection_id: connection.id, status: "needs_reauth" });
      } else {
        results.push({ connection_id: connection.id, status: "error", error: errorMessage(e) });
      }
    }
  }
  return Response.json({ results });
}
