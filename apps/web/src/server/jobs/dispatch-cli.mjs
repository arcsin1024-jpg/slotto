// 手で /api/internal/dispatch を呼ぶ(ローカルで pg_cron が使えないときの代わり)。
//
//   pnpm --filter @slotto/web jobs:dispatch              1 回だけ呼ぶ
//   pnpm --filter @slotto/web jobs:dispatch -- --watch   毎分呼び続ける(Ctrl+C で止める)
//
// 呼び先は DISPATCH_URL(既定 http://localhost:3004/api/internal/dispatch)。
// CRON_SECRET は環境変数か apps/web/.env.local から読む。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

function readEnvLocal() {
  try {
    const path = fileURLToPath(new URL("../../../.env.local", import.meta.url));
    const values = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
    return values;
  } catch {
    return {};
  }
}

const envLocal = readEnvLocal();
const secret = process.env.CRON_SECRET ?? envLocal.CRON_SECRET;
const url = process.env.DISPATCH_URL ?? envLocal.DISPATCH_URL ?? "http://localhost:3004/api/internal/dispatch";
const watch = process.argv.includes("--watch");

if (!secret) {
  console.error("CRON_SECRET が見つかりません(環境変数か apps/web/.env.local に設定してください)");
  process.exit(1);
}

async function dispatchOnce() {
  const started = new Date();
  try {
    const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    const text = await response.text();
    console.log(`[${started.toLocaleTimeString()}] ${response.status} ${text}`);
    return response.ok;
  } catch (error) {
    console.error(`[${started.toLocaleTimeString()}] ${url} に接続できません: ${error.message}`);
    return false;
  }
}

if (watch) {
  console.log(`${url} を毎分呼びます(Ctrl+C で止める)`);
  await dispatchOnce();
  setInterval(dispatchOnce, 60_000);
} else {
  process.exit((await dispatchOnce()) ? 0 : 1);
}
