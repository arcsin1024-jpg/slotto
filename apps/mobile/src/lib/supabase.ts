import type { Database } from "@slotto/core/database";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import { env } from "@/lib/env";
import { secureStorage } from "@/lib/secure-storage";

/**
 * Supabase のクライアント。データは行レベルセキュリティで自分の行だけ見える。
 * PKCE 方式にして、メールのリンクと Google のログインは `code` をアプリで交換する。
 */
export const supabase = createClient<Database>(env.supabaseUrl, env.supabasePublishableKey, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: "pkce",
  },
});

// アプリが前面にあるときだけトークンを自動で更新する
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
