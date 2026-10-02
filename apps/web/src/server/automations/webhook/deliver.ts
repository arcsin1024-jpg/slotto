import "server-only";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { LookupAddress } from "node:dns";
import { checkWebhookUrl, resolvePublicAddresses, WebhookUrlError } from "./ssrf";
import { webhookHeaders } from "./signature";

/**
 * Webhook の送信。ユーザーが登録した URL への送信は、すべてこの関数を通す(他の場所から直接 fetch しない)。
 * - 送信のたびに URL とアドレスを検査し、接続先を検査したアドレスに固定する(DNS リバインディング対策)
 * - リダイレクトは追わない(3xx は失敗として扱う)
 * - タイムアウト 15 秒、応答本文は 64KB まで読んで捨てる(内容は保存もユーザーへの返却もしない)
 * - Standard Webhooks の署名を付ける
 */

const TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_BODY_BYTES = 64 * 1024;

export interface WebhookDelivery {
  url: string;
  method: "POST" | "PUT";
  /** 署名の秘密の値 */
  secret: string;
  /** webhook-id。再送でも同じ値にする */
  webhookId: string;
  payload: unknown;
}

export interface WebhookResult {
  ok: boolean;
  /** 応答のステータス。接続できなかったときは null */
  status: number | null;
  durationMs: number;
  /** 失敗の理由(利用者に見せてよい文言) */
  error?: string;
  /** 送信先が「もう送らないで」と返した(410) */
  gone?: boolean;
}

const lookupAll = (hostname: string) => lookup(hostname, { all: true, verbatim: true });

export async function deliverWebhook(input: WebhookDelivery): Promise<WebhookResult> {
  const started = Date.now();
  const elapsed = () => Date.now() - started;

  let url: URL;
  let addresses: Awaited<ReturnType<typeof resolvePublicAddresses>>;
  try {
    url = checkWebhookUrl(input.url);
    addresses = await resolvePublicAddresses(url.hostname, lookupAll);
  } catch (error) {
    const message = error instanceof WebhookUrlError ? error.message : "送信先を確かめられません";
    return { ok: false, status: null, durationMs: elapsed(), error: message };
  }

  const body = JSON.stringify(input.payload);
  if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
    return { ok: false, status: null, durationMs: elapsed(), error: "送る内容が大きすぎます" };
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": String(Buffer.byteLength(body)),
    "User-Agent": "Slotto-Webhooks/1.0",
    ...webhookHeaders({ id: input.webhookId, timestamp, body, secret: input.secret }),
  };

  return new Promise<WebhookResult>((resolve) => {
    let settled = false;
    const finish = (result: Omit<WebhookResult, "durationMs">) => {
      if (settled) return;
      settled = true;
      resolve({ ...result, durationMs: elapsed() });
    };

    const req = request(
      url,
      {
        method: input.method,
        headers,
        timeout: TIMEOUT_MS,
        // 名前解決を、検査済みのアドレスに差し替える。TLS の SNI と Host ヘッダは元のホスト名のまま
        lookup: (_hostname, options, callback) => {
          const all = addresses.map<LookupAddress>((a) => ({ address: a.address, family: a.family }));
          if ((options as { all?: boolean }).all) {
            (callback as unknown as (err: null, addresses: LookupAddress[]) => void)(null, all);
          } else {
            callback(null, all[0]!.address, all[0]!.family);
          }
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > MAX_RESPONSE_BYTES) res.destroy();
        });
        const done = () => {
          if (status >= 200 && status < 300) finish({ ok: true, status });
          else if (status >= 300 && status < 400) finish({ ok: false, status, error: "リダイレクトには従いません" });
          else finish({ ok: false, status, error: `HTTP ${status}`, gone: status === 410 });
        };
        res.on("end", done);
        res.on("close", done);
        res.on("error", done);
      },
    );
    req.on("timeout", () => {
      req.destroy();
      finish({ ok: false, status: null, error: "時間内に応答がありませんでした" });
    });
    req.on("error", () => finish({ ok: false, status: null, error: "送信先に接続できませんでした" }));
    req.end(body);
  });
}
