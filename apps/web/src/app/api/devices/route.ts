import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, getApiUser, unauthorized } from "@/server/auth";
import { isExpoPushToken } from "@/server/push/expo";

/**
 * アプリのプッシュ通知のトークンの登録と削除。
 * POST: { expo_push_token, platform, device_name?, app_version? }。同じトークンが別のユーザーにあれば付け替える(端末でログインし直した場合)
 * DELETE: { expo_push_token }(ログアウト時)
 */

const tokenSchema = z.string().refine(isExpoPushToken, "プッシュ通知のトークンの形式が正しくありません");

const registerSchema = z.object({
  expo_push_token: tokenSchema,
  platform: z.enum(["ios", "android"]),
  device_name: z.string().max(100).nullish(),
  app_version: z.string().max(40).nullish(),
});

const removeSchema = z.object({ expo_push_token: tokenSchema });

export async function POST(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid", parsed.error.issues[0]?.message ?? "入力が正しくありません");

  const { data, error } = await createAdminClient()
    .from("push_devices")
    .upsert(
      {
        user_id: user.id,
        expo_push_token: parsed.data.expo_push_token,
        platform: parsed.data.platform,
        device_name: parsed.data.device_name ?? null,
        app_version: parsed.data.app_version ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "expo_push_token" },
    )
    .select("id, platform, device_name, app_version, last_seen_at, created_at")
    .single();
  if (error) {
    console.error("[devices] 登録に失敗しました", error.message);
    return apiError(500, "internal", "端末を登録できませんでした");
  }
  return Response.json({ device: data });
}

export async function DELETE(request: Request) {
  const user = await getApiUser(request);
  if (!user) return unauthorized();
  const parsed = removeSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid", parsed.error.issues[0]?.message ?? "入力が正しくありません");

  const { error } = await createAdminClient()
    .from("push_devices")
    .delete()
    .eq("user_id", user.id)
    .eq("expo_push_token", parsed.data.expo_push_token);
  if (error) {
    console.error("[devices] 削除に失敗しました", error.message);
    return apiError(500, "internal", "端末の登録を消せませんでした");
  }
  return new Response(null, { status: 204 });
}
