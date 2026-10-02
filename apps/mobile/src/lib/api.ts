import { env } from "@/lib/env";
import { supabase } from "@/lib/supabase";

/**
 * Web の API(設計書 8 章)を呼ぶ。サーバーの処理が要る操作(予約の承認、外部予定の選択、
 * 接続先の登録など)に使う。Supabase のアクセストークンを Bearer で付ける。
 */

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export async function apiFetch<T = unknown>(method: Method, path: string, body?: unknown): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new ApiError(401, "unauthorized", "ログインが必要です");

  let response: Response;
  try {
    response = await fetch(`${env.apiUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "network", "サーバーにつながりません。通信の状態を確かめてください");
  }

  const text = await response.text();
  const json = text ? safeJson(text) : null;
  if (!response.ok) {
    // Web の API は { error: { code, message } } で返す(apps/web/src/server/auth.ts の apiError)
    const error = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(response.status, error?.code ?? "unknown", error?.message ?? "うまくいきませんでした");
  }
  return json as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export const api = {
  get: <T>(path: string) => apiFetch<T>("GET", path),
  post: <T>(path: string, body?: unknown) => apiFetch<T>("POST", path, body ?? {}),
  delete: <T>(path: string, body?: unknown) => apiFetch<T>("DELETE", path, body),
};
