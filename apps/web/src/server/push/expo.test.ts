import { describe, expect, it } from "vitest";
import { buildNotificationMessages, buildSyncMessages, chunk, isExpoPushToken, readTickets } from "./expo";

describe("isExpoPushToken", () => {
  it("Expo のトークンの形だけ通す", () => {
    expect(isExpoPushToken("ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExpoPushToken[xxxxxxxxxxxxxxxxxxxxxx]")).toBe(true);
    expect(isExpoPushToken("ExponentPushToken[]")).toBe(false);
    expect(isExpoPushToken("fcm-token-abc")).toBe(false);
  });
});

describe("メッセージの組み立て", () => {
  it("アラームは専用のチャンネルと時間厳守の通知", () => {
    const [message] = buildNotificationMessages(["t1"], { title: "まもなく", alarm: true });
    expect(message).toMatchObject({ to: "t1", title: "まもなく", channelId: "event-alarm", interruptionLevel: "time-sensitive" });
    expect(message).not.toHaveProperty("body");
  });
  it("通常の通知はオートメーションのチャンネル", () => {
    const [message] = buildNotificationMessages(["t1"], { title: "a", body: "b", data: { type: "open_url", url: "https://x" } });
    expect(message).toMatchObject({ channelId: "automation-result", interruptionLevel: "active", body: "b" });
  });
  it("同期の知らせは表示しない", () => {
    const [message] = buildSyncMessages(["t1"], "booking");
    expect(message).toEqual({ to: "t1", data: { type: "sync", reason: "booking" }, _contentAvailable: true, priority: "normal", ttl: 3600 });
  });
  it("100 件ずつに分ける", () => {
    expect(chunk(Array.from({ length: 250 }, (_, i) => i), 100).map((c) => c.length)).toEqual([100, 100, 50]);
  });
});

describe("readTickets", () => {
  it("成功数と、無効になったトークンを拾う", () => {
    const messages = buildNotificationMessages(["t1", "t2", "t3"], { title: "x" });
    const result = readTickets(messages, [
      { status: "ok", id: "1" },
      { status: "error", message: "not registered", details: { error: "DeviceNotRegistered" } },
      { status: "error", message: "too big", details: { error: "MessageTooBig" } },
    ]);
    expect(result).toEqual({ ok: 1, invalidTokens: ["t2"], errors: ["MessageTooBig"] });
  });
});
