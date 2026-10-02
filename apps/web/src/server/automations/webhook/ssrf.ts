import { BlockList, isIP } from "node:net";

/**
 * Webhook の送信先の検査(SSRF 対策)。
 * - https だけ、ポートは 443 だけ、URL にユーザー名・パスワードを含めない
 * - ホスト名を引いて得たすべてのアドレスが公開アドレスであること
 * - 接続は検査したアドレスに固定する(deliver.ts の lookup)。DNS リバインディングを防ぐ
 * 文字列の正規表現ではなく、URL パーサーと node:net の BlockList で判定する。
 */

export class WebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookUrlError";
  }
}

const blockedV4 = new BlockList();
const blockedV6 = new BlockList();

// IPv4: 公開されていない範囲(RFC 6890 などの特別用途)
for (const [network, prefix] of [
  ["0.0.0.0", 8], // この網
  ["10.0.0.0", 8], // プライベート
  ["100.64.0.0", 10], // キャリアグレード NAT
  ["127.0.0.0", 8], // ループバック
  ["169.254.0.0", 16], // リンクローカル(クラウドのメタデータ 169.254.169.254 を含む)
  ["172.16.0.0", 12], // プライベート
  ["192.0.0.0", 24], // IETF の予約
  ["192.0.2.0", 24], // 文書用
  ["192.88.99.0", 24], // 6to4 中継
  ["192.168.0.0", 16], // プライベート
  ["198.18.0.0", 15], // 性能試験用
  ["198.51.100.0", 24], // 文書用
  ["203.0.113.0", 24], // 文書用
  ["224.0.0.0", 4], // マルチキャスト
  ["240.0.0.0", 4], // 予約、ブロードキャスト
] as const) {
  blockedV4.addSubnet(network, prefix, "ipv4");
}

// IPv6
for (const [network, prefix] of [
  ["::", 128], // 未指定
  ["::1", 128], // ループバック
  ["::ffff:0:0", 96], // IPv4 射影(中身の IPv4 に関わらず拒否する)
  ["64:ff9b::", 96], // NAT64(内部の IPv4 に届きうる)
  ["64:ff9b:1::", 48], // ローカルの NAT64
  ["100::", 64], // 破棄用
  ["2001::", 23], // IETF のプロトコル用(Teredo など)
  ["2001:db8::", 32], // 文書用
  ["2002::", 16], // 6to4(内部の IPv4 を埋め込める)
  ["fc00::", 7], // ユニークローカル
  ["fe80::", 10], // リンクローカル
  ["fec0::", 10], // サイトローカル(廃止)
  ["ff00::", 8], // マルチキャスト
] as const) {
  blockedV6.addSubnet(network, prefix, "ipv6");
}

const globalUnicastV6 = new BlockList();
globalUnicastV6.addSubnet("2000::", 3, "ipv6");

/** 公開アドレスか。IPv6 はグローバルユニキャスト(2000::/3)のうち、特別用途を除いたものだけを通す */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return !blockedV4.check(address, "ipv4");
  if (family === 6) {
    const normalized = address.split("%")[0]!; // ゾーン ID を外す
    return globalUnicastV6.check(normalized, "ipv6") && !blockedV6.check(normalized, "ipv6");
  }
  return false;
}

/** URL から角括弧を外したホスト名(IPv6 リテラル用) */
export function bareHostname(url: URL): string {
  return url.hostname.replace(/^\[(.*)\]$/, "$1");
}

/**
 * URL の形だけで分かる検査(DNS を引かない)。登録時と送信時の両方で使う。
 * IP アドレスが直接書かれている場合は、ここで公開アドレスかを確かめる(接続時に名前解決されないため)。
 */
export function checkWebhookUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new WebhookUrlError("URL の形式が正しくありません");
  }
  if (url.protocol !== "https:") throw new WebhookUrlError("https の URL だけ使えます");
  if (url.username || url.password) throw new WebhookUrlError("URL にユーザー名やパスワードを含めないでください");
  if (url.port !== "" && url.port !== "443") throw new WebhookUrlError("ポートは 443 だけ使えます");

  const host = bareHostname(url).toLowerCase();
  if (!host) throw new WebhookUrlError("ホスト名がありません");
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new WebhookUrlError("内部ネットワーク宛てには送れません");
    return url;
  }
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    throw new WebhookUrlError("内部ネットワーク宛てには送れません");
  }
  if (!host.includes(".")) throw new WebhookUrlError("ホスト名が正しくありません");
  return url;
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

export type LookupAll = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

/** ホスト名を引き、すべてのアドレスが公開アドレスであることを確かめる。1 つでも内部宛てがあれば拒否する */
export async function resolvePublicAddresses(hostname: string, lookupAll: LookupAll): Promise<ResolvedAddress[]> {
  const host = hostname.replace(/^\[(.*)\]$/, "$1");
  if (isIP(host)) {
    if (!isPublicAddress(host)) throw new WebhookUrlError("内部ネットワーク宛てには送れません");
    return [{ address: host, family: isIP(host) as 4 | 6 }];
  }
  let records: Array<{ address: string; family: number }>;
  try {
    records = await lookupAll(host);
  } catch {
    throw new WebhookUrlError("送信先のホスト名を解決できません");
  }
  if (records.length === 0) throw new WebhookUrlError("送信先のホスト名を解決できません");
  for (const record of records) {
    if (!isPublicAddress(record.address)) throw new WebhookUrlError("内部ネットワーク宛てには送れません");
  }
  return records.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
}
