import "server-only";

/**
 * 公開 API の簡単な回数制限(固定の時間枠で数える)。
 * サーバーのメモリに持つので、インスタンスをまたいだ合計にはならない。
 * 本番で厳密にしたくなったら、DB や KV に置き換える。
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
}

/** 呼び出し元の IP。わからなければ "unknown" にまとめる */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export interface RateLimitRule {
  /** 名前(API ごとに分ける) */
  name: string;
  limit: number;
  windowMs: number;
}

/** 回数を 1 つ数え、上限を超えていれば再試行までの秒数を返す。超えていなければ null */
export function hitRateLimit(request: Request, rule: RateLimitRule): number | null {
  const now = Date.now();
  sweep(now);
  const key = `${rule.name}:${clientIp(request)}`;
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + rule.windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > rule.limit) return Math.ceil((bucket.resetAt - now) / 1000);
  return null;
}

export const RATE_LIMITS = {
  /** 予約ページと空き枠の読み出し */
  read: { name: "public-read", limit: 120, windowMs: 60_000 },
  /** 予約の作成・キャンセル・日程変更 */
  write: { name: "public-write", limit: 10, windowMs: 60_000 },
} satisfies Record<string, RateLimitRule>;
