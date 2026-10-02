import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@slotto/core/database";
import { publicEnv } from "@/lib/env";

/**
 * サーバーコンポーネント、Server Actions、Route Handler 用。
 * ログイン中のユーザーの権限(行レベルセキュリティ)で読み書きする。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // サーバーコンポーネントからは Cookie を書けない。
          // セッションの更新は proxy.ts が行うので、ここでは無視してよい
        }
      },
    },
  });
}
