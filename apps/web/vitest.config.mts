import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// サーバー側の純粋なロジックの単体テスト(src/**/*.test.ts)
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
