# S7 紹介サイト: 指示書

紹介サイト(トップ、料金、法務ページ)を作る。デザインの方向とデザインシステムが決まってから始める。

## 読むもの

- `docs/sessions/common.md`
- `docs/design.md` の 1 章と 3.7 章
- `docs/design-brief.md`(特に 6 章「紹介サイト」)と `design/README.md`
- `docs/research/ui-references.md`(Slack などの紹介サイトの構成)
- `docs/research/timerex-features.md` の 1 章と 10 章(料金と、TimeRex の強み・不満点)

## 担当の場所

`apps/web/src/app/(marketing)/`、`apps/web/src/features/marketing/`。

## 手順

1. トップページのモックを Claude Design で作る。ファーストビューに製品画面を大きく見せる。見出しは短く言い切る。機能紹介(TimeRex に無い「選んだ予定だけ反映」とアプリ限定機能を目立たせる)→ 使い方 3 ステップ → アプリ限定機能 → 料金 → よくある質問 → フッター
2. **ユーザーに見せて確認を取る**
3. 実装する。`/`、`/pricing`、`/legal/terms`、`/legal/privacy`。法務ページは「たたき台」と明記した仮の文面でよい(本番前に専門家の確認が要ることを最終報告に書く)。メタデータと OGP を設定する
4. スマホ幅でも崩れないことを確かめ、**ユーザーに画面を見てもらう**
