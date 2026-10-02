import * as SecureStore from "expo-secure-store";

/**
 * Supabase のセッションを、端末の暗号化ストレージ(iOS は Keychain、Android は Keystore)に保存する。
 *
 * SecureStore は 1 つの値が 2048 バイトまでなので、長い値は分割して保存する。
 * `<key>` に分割数、`<key>.0`、`<key>.1`… に本体を置く。
 */

const CHUNK_SIZE = 1800;

// SecureStore のキーに使える文字は英数字と . - _ だけ
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

async function removeChunks(key: string, from: number, to: number) {
  for (let i = from; i < to; i++) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
}

async function chunkCount(key: string): Promise<number> {
  const value = await SecureStore.getItemAsync(key);
  const count = value ? Number.parseInt(value, 10) : 0;
  return Number.isFinite(count) ? count : 0;
}

export const secureStorage = {
  async getItem(rawKey: string): Promise<string | null> {
    const key = safeKey(rawKey);
    const count = await chunkCount(key);
    if (count === 0) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}.${i}`);
      // 途中が欠けていたら壊れているので、無いものとして扱う
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join("");
  },

  async setItem(rawKey: string, value: string): Promise<void> {
    const key = safeKey(rawKey);
    const previous = await chunkCount(key);
    const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(key, String(count));
    if (previous > count) await removeChunks(key, count, previous);
  },

  async removeItem(rawKey: string): Promise<void> {
    const key = safeKey(rawKey);
    const count = await chunkCount(key);
    await SecureStore.deleteItemAsync(key);
    await removeChunks(key, 0, count);
  },
};
