import { safeReturnTo } from "./google/state";

/** 戻り先(サイト内のパスかアプリのディープリンク)に、結果のクエリを付けた絶対 URL を作る */
export function withQuery(returnTo: string | null, origin: string, query: Record<string, string>): string {
  const target = safeReturnTo(returnTo);
  const url = target.startsWith("slotto://") ? new URL(target) : new URL(target, origin);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return url.toString();
}
