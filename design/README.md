# design/

Slotto のデザインの元ファイル。担当は S1(デザイン)。

## アーティファクト(Claude Design)

| 名前 | 種類 | URL | 中身 |
|---|---|---|---|
| Slotto Design System | Design System | https://claude.ai/artifact/BUWjmReHj5XdTyRvvbN5VV | 色(ライト・ダーク)、書体、余白、角丸、影、部品 21 種の見本と使い方、ロゴ、アプリアイコン |
| Slotto 管理画面の骨組み | Design | https://claude.ai/artifact/2xzUNznJGuzv8n1G73Rwrk | サイドバー、ヘッダー、予約一覧 + 詳細パネル。ライト、ダーク、狭い幅(S3 と S5 が共通で使う) |
| Slotto デザインの方向 | Design | https://claude.ai/artifact/9HFU3be7R5F3ZjomoDn3RK | 最初に比べた 3 案(記録用)。A 案に決定 |

アーティファクトは非公開。ほかの人に見せるときは、各ページの共有メニューから共有する。

## 決まったこと(2026-10-03)

- **方向: A 案「ミッドナイト」。** 紺のサイドバー(#131B31)と明るい作業面の対比に、主色の青(#2456D3)を要所だけ使う
- **書体:** 欧文 Geist、和文 Noto Sans JP、コードと URL は Geist Mono(いずれも SIL OFL、Google Fonts)。時刻と件数は等幅の数字(`tabular-nums`)。アプリは端末の書体を使い、大きさと太さを揃える
- **色:** ライトとダークの 2 組。文字と地の組み合わせ 142 組が、両方のテーマで WCAG AA を満たすことを `design/tokens/build.mjs` が毎回確かめる
- **形:** 余白は 4px 刻み、角丸は 4 / 6 / 10 / 14px、線は 1px。影は浮いているもの(ダイアログ、メニュー)だけ
- **ロゴ:** 小文字の「slotto」を線で組み、2 つの「t」の横棒を 1 本の青い帯でつないで予約枠に見立てる
- **アプリアイコン: 青の地(`logo/app-icon-blue.svg`)に決定。** 紺の地の案は不採用

細かい規則(文言、部品ごとの状態、アイコン)はデザインシステムの README と部品の README にある。

## ロゴの使い方

| ファイル | 使うところ |
|---|---|
| `logo/slotto-wordmark.svg` | 明るい地。文字 #121826、帯 #2456D3 |
| `logo/slotto-wordmark-on-dark.svg` | 濃い地(サイドバーなど)。文字 白、帯 #87B1FD |
| `logo/slotto-wordmark-mono.svg` | 1 色で刷るとき |
| `logo/slotto-symbol.svg` / `-on-dark.svg` | 記号(「tt」と帯)。高さ 16px 未満、ファビコン、畳んだサイドバー |
| `logo/app-icon-blue.svg` | アプリアイコン(採用)。正方形いっぱいに描いてあり、角丸は OS がかける。1024 × 1024 で書き出す |

- 周りの余白は「o」の高さ以上。高さ 16px 未満では文字のロゴを使わず記号にする
- 変形、色の入れ替え、影や縁取りはしない。帯以外の部分に色を付けない

## トークンの使い方(`packages/tokens`)

値の元は `tokens/source.mjs` の 1 か所だけ。`packages/tokens/src/tokens.css`、`packages/tokens/src/index.ts`、デザインシステムの tokens.json は、すべてここから生成する。生成したファイルを直接書き換えない。

**Web(Next.js)**

```ts
// app/layout.tsx など
import "@slotto/tokens/tokens.css";
```

- ライトは `:root`、ダークは `<html class="dark">`。変数の名前は `--color-bg`、`--color-text-muted`、`--color-primary`、`--page-blue`、`--space-4`、`--radius-md`、`--shadow-md`、`--layout-sidebar-width` など
- 書体は `tokens.css` では読み込まない。`next/font/google` で Geist、Noto_Sans_JP、Geist_Mono を読み込み、`--font-sans` と `--font-mono` をその書体の変数で上書きする(Tailwind v4 の `@theme` から参照する)
- 予約ページの色は `--page-<色>`(点や帯)と `--page-<色>-soft`(チップの地。上の文字は `--color-text`)

**アプリ(Expo)**

```ts
import { color, pageColor, space, radius, textStyle } from "@slotto/tokens";

const c = color[scheme]; // scheme は "light" か "dark"
c.textMuted; // CSS の --color-text-muted と同じ値
pageColor[scheme].blueSoft;
```

## 生成のしかた

```bash
node design/tokens/build.mjs --check              # コントラストの確認だけ
node design/tokens/build.mjs --packages           # packages/tokens/src を生成
node design/tokens/build.mjs --ds <フォルダ>       # デザインシステムの tokens.json を生成
node design/system/build.mjs <フォルダ>            # デザインシステムの README と部品
node design/logo/build.mjs                         # ロゴとアプリアイコンの SVG
node design/skeleton/build.mjs <フォルダ> <DS の URL>  # 管理画面の骨組みのモック
```

色を変えたら `--check` を通してから `--packages` を実行し、デザインシステムにも同じ tokens.json を載せる。

## フォルダ

| 場所 | 中身 |
|---|---|
| `tokens/` | トークンの元(`source.mjs`)と生成(`build.mjs`) |
| `system/` | デザインシステムの README、部品の見本と使い方、見本用の CSS |
| `logo/` | ロゴとアプリアイコンの SVG と生成スクリプト |
| `skeleton/` | 管理画面の骨組みのモックの生成 |
| `directions/` | 最初に比べた 3 案(記録用) |
| `lib/` | 色の計算(OKLCH、コントラスト比)と線のアイコン |
