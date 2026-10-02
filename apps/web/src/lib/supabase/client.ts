import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@slotto/core/database";
import { publicEnv } from "@/lib/env";

/** ブラウザ用。ログイン中のユーザーの権限(行レベルセキュリティ)で読み書きする */
export function createClient() {
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey);
}
