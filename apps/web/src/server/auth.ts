import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/** ログイン中のユーザー。未ログインなら null。同じリクエストの中では 1 回だけ確かめる */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
});

/** ログインが必要なページ用。未ログインならログインへ送る */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** ログイン中のユーザーのプロフィール。初回設定が済んでいなければ初回設定へ送る */
export async function requireProfile() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (!profile.username || !profile.onboarded_at) redirect("/app/welcome");
  return { user, profile };
}

/**
 * API(Route Handler)用。Web の Cookie か、アプリが送る `Authorization: Bearer <トークン>` の
 * どちらかでユーザーを確かめる。未ログインなら null。
 */
export async function getApiUser(request: Request): Promise<SessionUser | null> {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    const { data, error } = await createAdminClient().auth.getClaims(token);
    const claims = data?.claims;
    if (error || !claims?.sub) return null;
    return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
  }
  return getSessionUser();
}

/** API の共通の返し方 */
export function apiError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

export const unauthorized = () => apiError(401, "unauthorized", "ログインが必要です");
