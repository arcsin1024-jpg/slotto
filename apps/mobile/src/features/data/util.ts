import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Supabase の結果を取り出す。エラーなら投げる。
 * 行を返さない書き込み(select を付けない update / delete)では値を使わない
 */
export function unwrap<T>(result: { data: T | null; error: PostgrestError | null }): NonNullable<T> {
  if (result.error) throw new DataError(result.error.message, result.error.code);
  return result.data as NonNullable<T>;
}

/** maybeSingle() 用。行が無ければ null */
export function unwrapMaybe<T>(result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error) throw new DataError(result.error.message, result.error.code);
  return result.data;
}

export class DataError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "DataError";
  }
}

/** 書き込みに使う、ログイン中のユーザーの ID */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new DataError("ログインが必要です");
  return id;
}

/** JSON の列を型に合わせて読む。合わなければ null(古い形式のデータなどで画面を落とさない) */
export function parseJson<T>(
  schema: { safeParse(value: unknown): { success: true; data: T } | { success: false } },
  value: unknown,
): T | null {
  const result = schema.safeParse(value);
  return result.success ? result.data : null;
}
