# S1 デザイン: 指示書

Slotto のデザインの方向を決め、デザインシステムとトークンを作る。Claude Design(Artifact ツールの Design と Design System)を使う。

## 読むもの

1. `CLAUDE.md`
2. `docs/design-brief.md`(デザイン方針。これが主)
3. `docs/design.md` の 3 章と 4 章(機能と画面)
4. `docs/research/ui-references.md`(参考リサーチ。worktree に無ければ `C:\Users\81703\slotto\docs\research\ui-references.md` を読む。まだ無ければ、無いまま進めてよい)

## 担当の場所

`design/` と `packages/tokens/` だけを変更する。

## 手順

### 1. 方向の案を作って、確認を取る

1. Artifact ツールで `action: "quickstart"`、`intent: "design"` を呼び、返ってきた手順に従って Design のキャンバスを作る(名前: 「Slotto デザインの方向」)
2. 色と書体の方向が違う案を 2〜3 個作る。各案を、次の代表画面 3 つに当てて見せる
   - Web の管理画面のホーム(濃色のサイドバー + 今日の予定 + 承認待ち + 未選択の新着)
   - ゲストの予約ページ(月カレンダー + 時間枠)
   - アプリのホーム(次の予定 + 今日の予定)
3. 中身は本物らしい日本語のデータにする(人名、会議名、時刻)。ダミーの英文を置かない
4. **ここで止まり、ユーザーに確認を求める。** リンクを示し、どの案がよいか、直したい点はどこかを聞く。PushNotification ツールがあれば通知する

### 2. デザインシステムを作る

選ばれた方向で進める。

1. Artifact ツールで `action: "quickstart"`、`intent: "other"` を呼び、Design System の型からデザインシステムを作る(名前: 「Slotto Design System」)
2. 色(ライトとダーク)、書体、余白、角丸、影、罫線、部品(`docs/design-brief.md` の 7 章)を定義する
3. ロゴ(「slotto」の文字と記号)とアプリアイコンの案を作る。SVG を `design/logo/` に置く
4. 管理画面の骨組み(サイドバー、ヘッダー、一覧 + 詳細パネル)のモックを作る。これは S3 と S5 が共通で使う
5. **ここで止まり、ユーザーに確認を求める**

### 3. トークンをコードにする

1. `packages/tokens/src/` に、同じ元から出した 2 つを置く
   - `tokens.css`: Web 用の CSS 変数(ライトは `:root`、ダークは `.dark`)
   - `index.ts`: アプリ用の TypeScript の値(同じ名前、同じ値)
2. 名前は役割で付ける(例: `--color-bg`、`--color-surface`、`--color-sidebar`、`--color-primary`、`--color-text`、`--color-text-muted`、`--color-border`、`--radius-md`、`--space-4`)
3. `pnpm --filter @slotto/tokens typecheck` を通す

### 4. 仕上げ

1. `design/README.md` に、作ったアーティファクトの名前と URL、決まった方向の要約、ロゴの使い方を書く
2. コミットする
3. 最終報告: アーティファクトの URL、決まったこと、`packages/tokens` の使い方、他の担当への注意点

## 守ること

- 他社のロゴ・配色・固有の意匠を写さない(`docs/design-brief.md` の 3 章)
- 文字と背景のコントラストは WCAG AA 以上
- 確認を求めるときは、見てほしい点と、選んでほしいことを短く書く
- 同じ操作が 2 回失敗したら、3 回目を試さずに状況を報告する
