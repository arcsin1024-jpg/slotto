import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@slotto/core/database";
import { publicEnv, serverEnv } from "@/lib/env";

/**
 * 行レベルセキュリティを通さない、サーバー専用のクライアント。
 * ゲスト向けの処理、メール送信や外部連携を伴う書き込み、ジョブの実行に使う。
 * 呼ぶ側で、誰の行を触ってよいかを必ず確かめること。
 */
export function createAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv.supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
