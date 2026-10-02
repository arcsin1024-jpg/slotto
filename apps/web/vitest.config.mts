import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// 単体テスト(外部への通信をしない純粋な関数だけ。server-only を読み込むファイルはテストしない)
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"] },
});
