import "server-only";
import type { z } from "zod";
import { apiError } from "@/server/auth";
import type { BookingResult } from "./index";
import { hitRateLimit, type RateLimitRule } from "./rate-limit";

/** 予約の API(公開とホスト用)で共通の、入力の読み取りと結果の返し方 */

const STATUS_BY_CODE: Record<Extract<BookingResult, { ok: false }>["code"], number> = {
  not_found: 404,
  slot_taken: 409,
  invalid: 400,
  forbidden: 403,
  too_late: 422,
};

export function bookingFailure(result: Extract<BookingResult, { ok: false }>): Response {
  return apiError(STATUS_BY_CODE[result.code], result.code, result.message);
}

/** 回数制限を超えていれば 429 を返す */
export function rateLimited(request: Request, rule: RateLimitRule): Response | null {
  const retryAfter = hitRateLimit(request, rule);
  if (retryAfter === null) return null;
  const response = apiError(429, "rate_limited", "しばらく時間をおいてから、もう一度お試しください");
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}

/** JSON の本文を読み、スキーマで確かめる。本文が空なら {} として扱う */
export async function readJson<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let body: unknown = {};
  const text = await request.text();
  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      return { ok: false, response: apiError(400, "invalid", "本文が JSON の形ではありません") };
    }
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "入力が正しくありません";
    return { ok: false, response: apiError(400, "invalid", message) };
  }
  return { ok: true, data: parsed.data };
}

/** 想定外のエラー。中身はログにだけ出す */
export function internalError(error: unknown): Response {
  console.error("[booking] API で想定外のエラー", error);
  return apiError(500, "internal", "処理できませんでした。時間をおいてもう一度お試しください");
}
