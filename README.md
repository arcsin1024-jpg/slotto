# slotto

空き時間を共有して、相手に予約してもらう日程調整サービス(開発中)。

- **Web**: 紹介サイト、ホストの管理画面、ゲストの予約ページ(Next.js 16)
- **アプリ**: ホスト用(Expo / React Native)。予定の通知・アラームと、時間になったら API や AI を動かすオートメーションはアプリ限定
- **独自の機能**: Google カレンダーなどの予定を 1 件ずつ選んで反映できる。選んだ予定の時間だけ予約を受け付けない

## 構成

| 場所 | 中身 |
|---|---|
| `apps/web` | Next.js(App Router) |
| `apps/mobile` | Expo(Expo Router) |
| `packages/core` | 共有ロジック(型、入力検証、空き枠の計算) |
| `packages/tokens` | デザイントークン |
| `supabase` | DB のマイグレーションとデモデータ |
| `design` | デザインの元ファイル |
| `docs` | 設計書、実装計画、リサーチ |

設計は [docs/design.md](docs/design.md)、進め方は [docs/plan.md](docs/plan.md) を参照。

## ローカルで動かす

Node.js 24、pnpm 10、Docker、Supabase CLI が必要。

```bash
pnpm install
supabase start
cp apps/web/.env.example apps/web/.env.local   # 値は `supabase status` で確認
pnpm dev:web                                    # http://localhost:3000
```

ログイン画面の「開発用: デモユーザーでログイン」で、デモデータの入ったアカウントに入れる。
