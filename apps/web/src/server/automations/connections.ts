import "server-only";
import { lookup } from "node:dns/promises";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  apiConnectionConfigSchema,
  apiConnectionInputSchema,
  type ApiConnectionConfig,
  type ApiConnectionInput,
} from "@slotto/core";
import type { ApiConnectionRow } from "@slotto/core/database";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { toJson } from "@/server/jobs/store";
import { checkWebhookUrl, resolvePublicAddresses } from "./webhook/ssrf";
import { generateWebhookSecret, webhookIdFor } from "./webhook/signature";
import { deliverWebhook, type WebhookResult } from "./webhook/deliver";

/**
 * 接続先(Webhook の URL、AI の API キー)。
 * 秘密の値は @/lib/crypto で暗号化して api_connection_secrets に入れ、一度保存した値はクライアントに返さない。
 * ただし Webhook の署名の秘密の値を Slotto が作ったときだけ、作った直後に 1 回だけ返す(受け取る側の設定に要るため)。
 */

export class ConnectionError extends Error {
  constructor(
    readonly code: "invalid" | "not_found",
    message: string,
  ) {
    super(message);
    this.name = "ConnectionError";
  }
}

/** クライアントに返す形(秘密の値は含めない) */
export type PublicConnection = Pick<
  ApiConnectionRow,
  "id" | "kind" | "name" | "config" | "has_secret" | "last_used_at" | "created_at" | "updated_at"
>;

const PUBLIC_COLUMNS = "id, kind, name, config, has_secret, last_used_at, created_at, updated_at";

export const apiConnectionUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "名前を入力してください").max(60).optional(),
    config: apiConnectionConfigSchema.optional(),
    /** 新しい秘密の値(webhook の署名の値、ai の API キー) */
    secret: z.string().min(1).max(500).optional(),
    /** Webhook の署名の秘密の値を作り直す */
    rotate_secret: z.boolean().optional(),
  })
  .refine((v) => !(v.secret && v.rotate_secret), { message: "secret と rotate_secret は同時に指定できません" });

export type ApiConnectionUpdate = z.infer<typeof apiConnectionUpdateSchema>;

const lookupAll = (hostname: string) => lookup(hostname, { all: true, verbatim: true });

/** 登録時の検査。Webhook は URL の形と、名前解決の結果が公開アドレスであることを確かめる(送信のたびにも確かめる) */
async function validateConfig(config: ApiConnectionConfig): Promise<void> {
  if (config.kind !== "webhook") return;
  try {
    const url = checkWebhookUrl(config.url);
    await resolvePublicAddresses(url.hostname, lookupAll);
  } catch (error) {
    throw new ConnectionError("invalid", error instanceof Error ? error.message : "URL を確かめられません");
  }
}

async function saveSecret(connectionId: string, secret: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("api_connection_secrets")
    .upsert({ connection_id: connectionId, secret_enc: encryptSecret(secret) }, { onConflict: "connection_id" });
  if (error) throw new Error(`秘密の値を保存できません: ${error.message}`);
}

export async function listConnections(userId: string): Promise<PublicConnection[]> {
  const { data, error } = await createAdminClient()
    .from("api_connections")
    .select(PUBLIC_COLUMNS)
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw new Error(`api_connections を読めません: ${error.message}`);
  return data ?? [];
}

async function findOwned(userId: string, id: string): Promise<ApiConnectionRow> {
  const { data, error } = await createAdminClient()
    .from("api_connections")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`api_connections を読めません: ${error.message}`);
  if (!data) throw new ConnectionError("not_found", "接続先が見つかりません");
  return data;
}

function publicOf(row: ApiConnectionRow): PublicConnection {
  const { id, kind, name, config, has_secret, last_used_at, created_at, updated_at } = row;
  return { id, kind, name, config, has_secret, last_used_at, created_at, updated_at };
}

export async function createConnection(
  userId: string,
  input: ApiConnectionInput,
): Promise<{ connection: PublicConnection; signingSecret?: string }> {
  const parsed = apiConnectionInputSchema.parse(input);
  await validateConfig(parsed.config);

  let secret = parsed.secret?.trim() || undefined;
  let signingSecret: string | undefined;
  if (parsed.config.kind === "ai" && !secret) throw new ConnectionError("invalid", "API キーを入力してください");
  if (parsed.config.kind === "webhook" && !secret) {
    // 署名は必ず付けるので、指定が無ければ Slotto が作る
    secret = generateWebhookSecret();
    signingSecret = secret;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_connections")
    .insert({
      user_id: userId,
      kind: parsed.config.kind,
      name: parsed.name,
      config: toJson(parsed.config),
      has_secret: true,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`接続先を登録できません: ${error?.message}`);

  try {
    await saveSecret(data.id, secret!);
  } catch (e) {
    await admin.from("api_connections").delete().eq("id", data.id);
    throw e;
  }
  return { connection: publicOf(data), ...(signingSecret ? { signingSecret } : {}) };
}

export async function updateConnection(
  userId: string,
  id: string,
  input: ApiConnectionUpdate,
): Promise<{ connection: PublicConnection; signingSecret?: string }> {
  const parsed = apiConnectionUpdateSchema.parse(input);
  const current = await findOwned(userId, id);
  if (parsed.config) {
    if (parsed.config.kind !== current.kind) throw new ConnectionError("invalid", "接続先の種類は変えられません");
    await validateConfig(parsed.config);
  }
  if (parsed.rotate_secret && current.kind !== "webhook") {
    throw new ConnectionError("invalid", "作り直せるのは Webhook の署名の値だけです");
  }

  let signingSecret: string | undefined;
  if (parsed.secret) await saveSecret(id, parsed.secret.trim());
  if (parsed.rotate_secret) {
    signingSecret = generateWebhookSecret();
    await saveSecret(id, signingSecret);
  }

  const { data, error } = await createAdminClient()
    .from("api_connections")
    .update({
      ...(parsed.name ? { name: parsed.name } : {}),
      ...(parsed.config ? { config: toJson(parsed.config) } : {}),
      ...(parsed.secret || parsed.rotate_secret ? { has_secret: true } : {}),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error || !data) throw new Error(`接続先を更新できません: ${error?.message}`);
  return { connection: publicOf(data), ...(signingSecret ? { signingSecret } : {}) };
}

export async function deleteConnection(userId: string, id: string): Promise<void> {
  await findOwned(userId, id);
  const { error } = await createAdminClient().from("api_connections").delete().eq("id", id).eq("user_id", userId);
  if (error) throw new Error(`接続先を削除できません: ${error.message}`);
}

/** 実行用。設定と、復号した秘密の値。サーバーの中だけで使い、ログやクライアントに出さない */
export async function getConnectionForUse<K extends ApiConnectionConfig["kind"]>(
  userId: string,
  id: string,
  kind: K,
): Promise<{ row: ApiConnectionRow; config: Extract<ApiConnectionConfig, { kind: K }>; secret: string | null }> {
  const row = await findOwned(userId, id);
  const config = apiConnectionConfigSchema.safeParse(row.config);
  if (row.kind !== kind || !config.success || config.data.kind !== kind) {
    throw new ConnectionError("invalid", "接続先の種類が合いません");
  }
  const { data } = await createAdminClient()
    .from("api_connection_secrets")
    .select("secret_enc")
    .eq("connection_id", id)
    .maybeSingle();
  const secret = data?.secret_enc ? decryptSecret(data.secret_enc) : null;
  return { row, config: config.data as Extract<ApiConnectionConfig, { kind: K }>, secret };
}

export async function touchConnection(id: string): Promise<void> {
  await createAdminClient().from("api_connections").update({ last_used_at: new Date().toISOString() }).eq("id", id);
}

/** Webhook の接続先へ、署名付きのテストを送る */
export async function testWebhookConnection(userId: string, id: string): Promise<WebhookResult> {
  const { config, secret } = await getConnectionForUse(userId, id, "webhook");
  if (!secret) return { ok: false, status: null, durationMs: 0, error: "署名の秘密の値がありません" };
  const result = await deliverWebhook({
    url: config.url,
    method: config.method,
    secret,
    webhookId: webhookIdFor(`connection-test:${id}:${randomUUID()}`),
    payload: { type: "connection.test", timestamp: new Date().toISOString(), data: { connection_id: id } },
  });
  await touchConnection(id);
  return result;
}
