import { schedulePushSync } from "@/server/calendar/schedule";
import { findWatchedCalendar } from "@/server/calendar/watch";

/**
 * Google カレンダーの変更通知(events.watch)の受け口。
 * 通知は本文なしでヘッダーだけ届く。チャンネルのトークンを照合し、同期のジョブを入れる。
 * Google に再送させないよう、照合に失敗しても 200 を返す。
 */
export async function POST(request: Request) {
  const state = request.headers.get("x-goog-resource-state");
  // 張った直後の確認の通知。何もしない
  if (state === "sync") return new Response(null, { status: 200 });

  const watched = await findWatchedCalendar(
    request.headers.get("x-goog-channel-id"),
    request.headers.get("x-goog-channel-token"),
  );
  if (watched) await schedulePushSync(watched.connectionId, watched.userId);
  return new Response(null, { status: 200 });
}
