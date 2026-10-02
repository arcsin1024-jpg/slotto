# S5 管理画面: 指示書

ホストの管理画面(取り込みと連携を除く)を作る。デザインの方向とデザインシステムが決まってから始める。

## 読むもの

- `docs/sessions/common.md`
- `docs/design.md` の 3.1、3.3、3.5、4.3 章
- `docs/design-brief.md`(特に 6 章「Web の管理画面」)と `design/README.md`(デザインシステムの URL)
- `docs/research/timerex-features.md` の 2 章と 7 章(TimeRex の設定項目と管理画面)

## 担当の場所

`apps/web/src/app/(app)/`(`app/import/` と `app/integrations/` を除く)、`apps/web/src/features/host/`。サイドバー(`apps/web/src/components/app/`)の見た目を仕上げる必要があれば、変更内容を最終報告に書く(S0 が取り込む)。

## 手順

1. 管理画面のモックを Claude Design で作る: ホーム、予約ページの一覧と編集(右にプレビュー)、予約の一覧と詳細パネル、統合カレンダー(週・月)、設定、初回設定(ユーザー名 → 連携 → 予定を選ぶ → 最初の予約ページ)。デザインシステムの骨組み(サイドバー、一覧 + 詳細パネル)に沿わせる
2. **ユーザーに見せて確認を取る**
3. 実装する
   - 予約ページの作成・編集は `@slotto/core` の `bookingPageInputSchema` で検証し、Supabase に直接書く(行レベルセキュリティで自分の行だけ)。プレビューは `computeSlots` で空き枠を出す
   - 予約の承認・辞退・キャンセルは `@/server/booking`(S2)を Server Actions から呼ぶ
   - 統合カレンダーには、予約と反映中の外部予定(`is_selected = true`)だけを出す
   - 初回設定の「予定を選ぶ」段は、取り込み画面(S3)へのリンクでよい
   - アカウント削除(`/api/account/delete`)
4. デモユーザーで通して確かめ、**ユーザーに画面を見てもらう**
