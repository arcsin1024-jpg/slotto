import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { unregisterPushToken } from "@/features/notifications/push";
import { cancelAllEventNotifications } from "@/features/notifications/scheduler";
import { queryClient } from "@/lib/query-client";
import { supabase } from "@/lib/supabase";

/**
 * ログインの手段。Web と同じ Supabase のアカウントを使う。
 * - メールのリンク(マジックリンク)
 * - Google(ブラウザ方式。端末のブラウザでログインし、slotto:// でアプリに戻る)
 * - 開発用のデモユーザー(supabase/seed.sql)
 */

// supabase/seed.sql のデモユーザー(ローカル開発専用)
const DEV_EMAIL = "demo@slotto.test";
const DEV_PASSWORD = "slotto-demo-password";

/** ログイン後に戻ってくる URL。Expo Go では exp://…/--/auth/callback、ビルドでは slotto://auth/callback */
export function authRedirectUrl(): string {
  return Linking.createURL("auth/callback");
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function signInWithEmailLink(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw new AuthError(error.message);
}

export async function signInWithGoogle(): Promise<"signed_in" | "cancelled"> {
  const redirectTo = authRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw new AuthError(error?.message ?? "Google のログイン画面を開けませんでした");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return "cancelled";
  await completeSignInFromUrl(result.url);
  return "signed_in";
}

export async function signInAsDemo(): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: DEV_EMAIL, password: DEV_PASSWORD });
  if (error) throw new AuthError(error.message);
}

// 同じ code を 2 回交換しないようにする(ブラウザの戻りとディープリンクの両方で届くことがある)
const exchangedCodes = new Set<string>();

/** 戻り先の URL(`…/auth/callback?code=…`)からセッションを作る。Google のログインで使う */
export async function completeSignInFromUrl(url: string): Promise<void> {
  const { queryParams } = Linking.parse(url);
  const params: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(queryParams ?? {})) {
    if (typeof value === "string") params[key] = value;
  }
  await completeSignIn(params);
}

/** 戻り先の値(code、error_description)からセッションを作る。メールのリンクと Google の両方で使う */
export async function completeSignIn(params: {
  code?: string;
  error?: string;
  error_description?: string;
}): Promise<void> {
  const errorDescription = params.error_description ?? params.error;
  if (errorDescription) throw new AuthError(errorDescription);

  const code = params.code;
  if (!code) throw new AuthError("ログイン用のリンクが正しくありません");
  if (exchangedCodes.has(code)) return;
  exchangedCodes.add(code);

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    exchangedCodes.delete(code);
    throw new AuthError(error.message);
  }
}

/** ログアウト。この端末へのプッシュ通知と、予約済みの予定の通知も止める */
export async function signOut(): Promise<void> {
  await unregisterPushToken().catch(() => undefined);
  await cancelAllEventNotifications().catch(() => undefined);
  await supabase.auth.signOut();
  queryClient.clear();
}
