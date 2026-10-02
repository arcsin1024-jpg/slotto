# Slotto アプリ(apps/mobile)

ホスト用のアプリ。Expo SDK 57、Expo Router。Web と同じ Supabase のアカウントで使う。

## 動かす

1. `.env.example` を `.env` にコピーし、`supabase status` の値を入れる
2. ルートで `pnpm dev:mobile`(Expo の開発サーバー、ポート 8081)
3. Android エミュレータなら `a` キー、実機なら Expo Go で QR コードを読む
4. ログイン画面の「開発用: デモユーザーでログイン」で入る(`supabase/seed.sql` のデモユーザー)

## 構成

| 場所 | 中身 |
|---|---|
| `src/app/` | 画面(Expo Router)。`(app)/` はログイン後、`(app)/(tabs)/` が下のタブ |
| `src/features/auth/` | ログイン(メールのリンク、Google、デモユーザー)とセッション |
| `src/features/data/` | データの読み書きのフック。読み取りは Supabase を直接、サーバーの処理が要る操作は Web の API |
| `src/features/notifications/` | 通知とアラーム。予約の計画(`plan.ts`、単体テストあり)、張り直し、チャンネル、プッシュのトークン |
| `src/lib/` | 環境変数、Supabase(セッションは SecureStore に暗号化して保存)、API、データのキャッシュ |
| `src/strings/` | 画面の文言 |
| `src/theme/` | `@slotto/tokens` の色と寸法 |
| `src/components/basic.tsx` | 仮の部品。デザインが決まったら置き換える |

## Expo Go で動かない・確かめられないもの(development build が要る)

- サーバーからのプッシュ通知(Android の Expo Go では使えない)
- 通知チャンネルの音の設定、iOS の時間厳守の通知(app.json の entitlement)
- Android の正確なアラーム(`SCHEDULE_EXACT_ALARM`)

ローカル通知(予定の通知とアラームの予約、タップでの画面遷移)は Expo Go でも動く。
