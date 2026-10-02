/**
 * 環境変数の読み出し。
 * NEXT_PUBLIC_ の値はビルド時に埋め込まれるため、process.env.名前 の形でそのまま書く。
 */

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`環境変数 ${name} が設定されていません(apps/web/.env.local を確認)`);
  return value;
}

/** ブラウザにも渡る値 */
export const publicEnv = {
  get supabaseUrl() {
    return required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
  },
  get supabasePublishableKey() {
    return required(
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  },
  /** サイトの URL(末尾のスラッシュなし) */
  get appUrl() {
    return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
};

/** サーバーだけで使う値。クライアントのコードから読まないこと */
export const serverEnv = {
  get supabaseSecretKey() {
    return required(process.env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY");
  },
  /** トークンや API キーの暗号化に使う鍵(32 バイトを base64 にしたもの) */
  get tokenEncryptionKey() {
    return required(process.env.TOKEN_ENCRYPTION_KEY, "TOKEN_ENCRYPTION_KEY");
  },
  /** 内部 API(/api/internal/*)を守る共有シークレット */
  get cronSecret() {
    return required(process.env.CRON_SECRET, "CRON_SECRET");
  },
  // 以下は用意できるまで未設定でもよい。使う側で未設定の場合の動きを決める
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? "Slotto <no-reply@localhost>",
  aiGatewayApiKey: process.env.AI_GATEWAY_API_KEY,
  expoAccessToken: process.env.EXPO_ACCESS_TOKEN,
};
