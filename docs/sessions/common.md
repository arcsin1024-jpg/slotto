# 各セッション共通の指示

S2〜S7 の各セッションが最初に読む。自分の指示書(`docs/sessions/sN-*.md`)と合わせて従う。

## 最初にやること

1. `CLAUDE.md`(特に「並行開発のルール」)を読む
2. `docs/plan.md` の担当表で、自分が変更してよい場所を確かめる
3. `docs/design.md` の、自分に関係する章を読む
4. `pnpm install` を実行する(worktree には node_modules が無い)
5. 自分の指示書の手順に沿って進める

## 環境

- ローカルの Supabase は Docker が要る。`docker info` が失敗するときは、DB を使う確認を後回しにして、型と単体テストで進める。Docker が動いていれば、ルートで `supabase start`(すでに起動していればそのまま使う。**`supabase stop` と `supabase db reset` はしない**。他のセッションと共有しているため)
- 環境変数は `apps/web/.env.example` を `apps/web/.env.local` にコピーし、`supabase status` の値を入れる。`TOKEN_ENCRYPTION_KEY` と `CRON_SECRET` は自分で作る
- Web の開発サーバーは、担当表のポートで起動する: `pnpm --filter @slotto/web exec next dev -p <ポート>`
- デモユーザー: `demo@slotto.test` / `slotto-demo-password`(ログイン画面の「開発用」ボタン)
- DB の型は `packages/core/src/database.ts`(手書き)。列を足すマイグレーションを書いたら、その列の型を `database.ts` に足したいと最終報告に書く(`database.ts` は S0 の担当)

## つなぎ目

- 他の担当の機能は `docs/plan.md` の 3 章の入口(`@/server/booking` など)から呼ぶ。中身が未実装でも、呼ぶコードは書いてよい(`NotImplementedError` が投げられる)
- 呼ばれる側の入口の名前と引数は変えない。変えたいときは報告する

## デザイン

- 画面の見た目は、デザインの方向が決まってから作る。S1(デザイン)の成果は `design/README.md` と `packages/tokens` に入る。main に入っていなければ、司令塔から連絡があるまで画面の作り込みを後回しにする
- 色・余白・角丸は、Tailwind のトークン(`bg-primary`、`text-muted-foreground`、`bg-sidebar` など)を使い、色の値を直書きしない
- UI 部品は `apps/web/src/components/ui`(shadcn/ui)を使う。部品が足りなければ、自分の担当の場所に仮に作り、最終報告に書く
- 画面を作るときは、まず Claude Design(Artifact ツール、`action: "quickstart"`、`intent: "design"`)でモックを作り、**ユーザーに見せて確認を取ってから**実装する。デザインシステムのアーティファクトがあれば、それに沿わせる

## ユーザーへの確認

- モックや画面ができたら、その都度ユーザーに確認を求めて止まる。PushNotification ツールがあれば通知する
- 確認を求めるときは、リンク(アーティファクトの URL か、開発サーバーの URL)、見てほしい点、選んでほしいことを短く書く
- ユーザーへの説明は日本語で、短く具体的に

## 終わり方

1. `pnpm typecheck`、`pnpm lint`、`pnpm test` を通す
2. 自分のブランチにコミットする(プッシュしない)。コミットメッセージは日本語
3. 最終報告を `docs/sessions/reports/sN.md` に書き、コミットする。内容:
   - できたこと、確認したこと(実物で確認できなかったことは「未確認」と明記)
   - 変更した場所、追加した依存パッケージ、追加したマイグレーション
   - 他の担当への要望(担当外の場所で変えたいこと、つなぎ目の変更の希望)
   - 残っていること
4. 同じ内容を短くユーザーに伝える

## 守ること

- 同じ操作が 2 回失敗したら 3 回目を試さず、状況を報告する
- 1 つの確認作業(見た目の目視など)にツールを 5 回以上使いそうになったら、そこで報告する
- 秘密の値をコミットしない
- 外部サービスへの登録・送信・課金は行わない(ユーザーに頼む)
