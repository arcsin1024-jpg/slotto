/**
 * 環境変数。`apps/mobile/.env` に書く(見本は `.env.example`)。
 * EXPO_PUBLIC_ で始まる値はビルドに埋め込まれるので、秘密の値を置かない。
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`環境変数 ${name} がありません。apps/mobile/.env.example を見て .env を作ってください`);
  }
  return value;
}

// process.env.X の形で直接書かないと、Expo がビルド時に値を埋め込まない
export const env = {
  supabaseUrl: required("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: required(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  ),
  /** Web の URL。API の呼び出しと、予約ページの共有リンクに使う */
  apiUrl: required("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL).replace(/\/$/, ""),
  /** 開発用のデモユーザーでのログインを出すか */
  isDev: __DEV__,
};
