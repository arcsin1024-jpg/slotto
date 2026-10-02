import "server-only";
import { NotImplementedError } from "@/server/not-implemented";

/** アプリへのプッシュ通知(担当: S4 実行基盤) */

export interface PushMessage {
  title: string;
  body?: string;
  /** アプリが受け取るデータ。例: { type: "booking", id: "..." }、{ type: "open_url", url: "..." } */
  data?: Record<string, unknown>;
  /** アラームとして鳴らす(Android はアラーム用のチャンネル、iOS は時間厳守の通知) */
  alarm?: boolean;
}

/** ユーザーの全端末に送る。端末が無ければ何もしない */
export async function sendPush(userId: string, message: PushMessage): Promise<{ sent: number }> {
  void userId; void message;
  throw new NotImplementedError("sendPush", "S4");
}
