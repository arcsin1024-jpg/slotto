import { describe, expect, it } from "vitest";
import { checkWebhookUrl, isPublicAddress, resolvePublicAddresses, WebhookUrlError } from "./ssrf";
import {
  generateWebhookSecret,
  signWebhook,
  verifyWebhook,
  webhookIdFor,
  webhookSecretKey,
} from "./signature";

describe("isPublicAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254", // クラウドのメタデータ
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "::ffff:127.0.0.1", // IPv4 射影
    "::ffff:8.8.8.8",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "fe80::1%eth0",
    "ff02::1",
    "64:ff9b::a00:1", // NAT64 で 10.0.0.1
    "2002:a00:1::", // 6to4 で 10.0.0.1
    "2001:db8::1",
    "not-an-ip",
  ])("%s は拒否する", (address) => {
    expect(isPublicAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "203.0.114.1", "172.32.0.1", "2606:4700:4700::1111", "2001:4860:4860::8888"])(
    "%s は通す",
    (address) => {
      expect(isPublicAddress(address)).toBe(true);
    },
  );
});

describe("checkWebhookUrl", () => {
  it("公開されたホストの https は通す", () => {
    expect(checkWebhookUrl("https://hooks.example.com/slotto?x=1").hostname).toBe("hooks.example.com");
    expect(checkWebhookUrl("https://hooks.example.com:443/a").hostname).toBe("hooks.example.com");
    expect(checkWebhookUrl("https://8.8.8.8/a").hostname).toBe("8.8.8.8");
  });

  it.each([
    ["http://hooks.example.com/", "https"],
    ["ftp://hooks.example.com/", "https"],
    ["https://user:pass@hooks.example.com/", "ユーザー名"],
    ["https://hooks.example.com:8443/", "ポート"],
    ["https://localhost/", "内部"],
    ["https://app.localhost/", "内部"],
    ["https://printer.local/", "内部"],
    ["https://metadata.google.internal/", "内部"],
    ["https://intranet/", "ホスト名"],
    ["https://127.0.0.1/", "内部"],
    ["https://2130706433/", "内部"], // 10 進表記の 127.0.0.1
    ["https://0x7f.1/", "内部"], // 16 進表記
    ["https://[::1]/", "内部"],
    ["https://[::ffff:169.254.169.254]/", "内部"],
    ["https://169.254.169.254/latest/meta-data", "内部"],
    ["not a url", "形式"],
  ])("%s は拒否する", (url, message) => {
    expect(() => checkWebhookUrl(url)).toThrow(WebhookUrlError);
    expect(() => checkWebhookUrl(url)).toThrow(message);
  });
});

describe("resolvePublicAddresses", () => {
  const lookup = (records: Array<{ address: string; family: number }>) => async () => records;

  it("すべて公開アドレスなら通す", async () => {
    await expect(
      resolvePublicAddresses("hooks.example.com", lookup([{ address: "93.184.216.34", family: 4 }, { address: "2606:2800:220:1::1", family: 6 }])),
    ).resolves.toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1::1", family: 6 },
    ]);
  });
  it("1 つでも内部宛てがあれば拒否する(DNS で内部を指す名前)", async () => {
    await expect(
      resolvePublicAddresses("evil.example.com", lookup([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.5", family: 4 }])),
    ).rejects.toThrow("内部ネットワーク");
  });
  it("引けなければ拒否する", async () => {
    await expect(resolvePublicAddresses("none.example.com", lookup([]))).rejects.toThrow("解決できません");
    await expect(
      resolvePublicAddresses("none.example.com", async () => {
        throw new Error("ENOTFOUND");
      }),
    ).rejects.toThrow("解決できません");
  });
  it("IP リテラルは引かずに判定する", async () => {
    await expect(resolvePublicAddresses("[::1]", lookup([]))).rejects.toThrow("内部ネットワーク");
    await expect(resolvePublicAddresses("8.8.8.8", lookup([]))).resolves.toEqual([{ address: "8.8.8.8", family: 4 }]);
  });
});

describe("署名(Standard Webhooks)", () => {
  // Standard Webhooks の仕様にある例
  const example = {
    id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
    timestamp: 1614265330,
    body: '{"test": 2432232314}',
    secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
  };

  it("仕様の例と同じ署名になる", () => {
    expect(signWebhook(example)).toBe("v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=");
  });

  it("検証: 正しい署名、改ざん、古いタイムスタンプ、複数の署名", () => {
    const header = signWebhook(example);
    expect(verifyWebhook({ ...example, signatureHeader: header, now: example.timestamp + 10 })).toBe(true);
    expect(verifyWebhook({ ...example, body: '{"test": 1}', signatureHeader: header, now: example.timestamp })).toBe(false);
    expect(verifyWebhook({ ...example, signatureHeader: header, now: example.timestamp + 3600 })).toBe(false);
    expect(verifyWebhook({ ...example, signatureHeader: `v1,AAAA ${header}`, now: example.timestamp })).toBe(true);
  });

  it("秘密の値は whsec_ + 32 バイト", () => {
    const secret = generateWebhookSecret();
    expect(secret.startsWith("whsec_")).toBe(true);
    expect(webhookSecretKey(secret)).toHaveLength(32);
    expect(webhookSecretKey("plain-secret").toString("utf8")).toBe("plain-secret");
  });

  it("webhook-id は同じ配信なら同じ値", () => {
    expect(webhookIdFor("a:b:c")).toBe(webhookIdFor("a:b:c"));
    expect(webhookIdFor("a:b:c")).not.toBe(webhookIdFor("a:b:d"));
    expect(webhookIdFor("a:b:c")).toMatch(/^msg_[0-9a-f]{32}$/);
  });
});
