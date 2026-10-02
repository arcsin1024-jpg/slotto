# Slotto

日程調整サービス。Web サイト(主)とモバイルアプリの両方を作る。TimeRex の機能と流れを参考にするが、名称・ロゴ・文言・画像・コードは写さない。

## 最初に読むもの

- 設計書: `docs/design.md`(機能、画面、データモデル、API)
- 実装計画と担当分け: `docs/plan.md`
- デザイン方針: `docs/design-brief.md`
- リサーチ結果: `docs/research/`
- 自分の担当の指示書: `docs/sessions/`

## 決定事項

- 表記: サービス名は「Slotto」、ロゴは「slotto」、URL・パッケージ名は `slotto`。読みは「スロットー」。カタカナの「スロット」は前面に出さない
- UI の文言は日本語。後で英語を足せるよう、文言は画面ごとにまとめて置く
- UI の方向: Slack のような仕事効率化ツールの洗練。他社のロゴ・配色・固有の意匠はそのまま写さない
- UI は Claude Design(Artifact ツールの Design / Design System)でモックを作ってから実装する
- **モックや画面ができたら、その都度ユーザーに見せて確認を取ってから先へ進む**
- アプリ限定の機能: 通知・アラーム、オートメーション(時間になったら API や AI を動かす)。Web には設定画面を作らない

## 構成

pnpm ワークスペース(`node-linker=hoisted`)。

| 場所 | 中身 |
|---|---|
| `apps/web` | Next.js 16(App Router)。紹介サイト、ホストの管理画面、ゲストの予約ページ、API |
| `apps/mobile` | Expo SDK 57(Expo Router)。ホスト用アプリ |
| `packages/core` | 共有ロジック。型、入力検証(zod)、空き枠の計算 |
| `packages/tokens` | デザイントークン。Web とアプリで同じ値を使う |
| `supabase` | マイグレーションとシード |
| `design` | デザインの元ファイル |

- Next.js と Expo は学習時点から大きく変わっている。`apps/web/AGENTS.md` と `apps/mobile/AGENTS.md` に従い、書く前に同梱ドキュメントを読む
- Next.js 16 では middleware が `src/proxy.ts` に変わった
- アプリにパッケージを足すときは `apps/mobile` で `npx expo install <名前>` を使う
- React は Web とアプリで同じ版(19.2.3)に揃えている。勝手に上げない

## コマンド

```bash
pnpm install          # 依存のインストール(worktree を作った直後に必要)
pnpm dev:web          # Web の開発サーバー(http://localhost:3000)
pnpm dev:mobile       # Expo の開発サーバー
pnpm typecheck        # 全パッケージの型チェック
pnpm lint
pnpm test             # packages/core の単体テスト
supabase start        # ローカルの Supabase(Docker が必要)
supabase migration up # 新しいマイグレーションを適用
```

ローカルの Supabase のポートは 544xx 番台(API 54421、DB 54422、Studio 54423、メール確認 54424)。開発用のログインは `supabase/seed.sql` のデモユーザーを使う。

## 守ること

- Supabase の公開鍵の名前は `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_PUBLISHABLE_KEY`。`ANON_KEY` という名前は使わない。変数名も `publishableKey`
- 秘密の値(`.env*`、トークン、API キー)をコミットしない。見本は `.env.example` に名前だけ書く
- DB の定義は `supabase/migrations/` が正。型や検証は `packages/core` に置き、Web とアプリで同じものを使う
- 日時は UTC で保存し、表示のときにタイムゾーンを当てる

## 並行開発のルール

複数のセッションが同時に、それぞれの worktree とブランチで作業する。

- 自分の担当の場所だけを変更する(`docs/plan.md` の担当表)。他の担当の場所を変えたいときは、変更せずに最終報告に書く
- 共有部分(`packages/core`、`packages/tokens`、`supabase/migrations`、`apps/web/src/lib`、`apps/web/src/components/ui`、ルートの設定)を変えるのは、担当表でその場所を持つセッションだけ。足りないものがあれば、自分の担当の場所に仮置きして報告する
- マイグレーションは既存のファイルを書き換えず、新しいファイルを足す。`supabase db reset` は他のセッションのデータも消すので実行しない
- 開発サーバーのポートは担当表の番号を使う
- 依存パッケージの追加は最小限にし、追加したら最終報告に書く
- こまめにコミットする。コミットメッセージは日本語で、何をしたかを 1 行目に書く
- main の最新を取り込むときは `sync_with_base_branch` ツールを使う。使えなければ `git merge main`
- 作業の区切りでは、型チェックとリントを通してから報告する
