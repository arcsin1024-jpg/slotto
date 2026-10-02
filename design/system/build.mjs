// Design System「Slotto Design System」の中身を書き出す。
//   node design/system/build.mjs <出力先フォルダ>
// 出力先の project/ に README.md、部品(components/<名前>/README.md と preview.html)、
// components/bundle.css、表紙、素材の説明を書く。tokens.json は design/tokens/build.mjs --ds が書く。

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { icon } from "../lib/icons.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.argv[2];
if (!outDir) throw new Error("出力先フォルダを指定してください");
const project = join(outDir, "project");

function write(path, text) {
  const full = join(project, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, text);
}

// ---------- 部品 ----------

function preview({ group, height, title, body, surface = false, script = "" }) {
  return `<!-- @dsCard group="${group}" height=${height} -->
<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>${title}</title><style>body{margin:0}</style></head>
<body>
<div class="sl sl-preview${surface ? " sl-preview--surface" : ""}">
${body}
</div>${script ? `\n<script>\n${script}\n</script>` : ""}
</body>
</html>
`;
}

const labeled = (label, inner) => `<div class="sl-stack"><span class="sl-note">${label}</span>${inner}</div>`;

const C = {};

C.Button = {
  group: "操作",
  height: 236,
  readme: `# Button

画面の操作を 1 つ実行するボタン。主なボタンは 1 画面(1 つのパネル)に 1 つだけ置く。

## 種類

| 種類 | 使うところ | 色 |
|---|---|---|
| primary | その画面でいちばん大事な操作(「次へ」「承認」「保存」) | \`color-primary\` の地に \`color-primary-text\` |
| secondary | 並ぶ副の操作(「辞退」「リンクをコピー」) | \`color-bg\` の地、\`color-border-strong\` の枠 |
| ghost | ツールバー、アイコンだけのボタン | 地なし。カーソルで \`color-surface-hover\` |
| danger | 取り消せない操作(「予約をキャンセル」「削除」) | \`color-danger\` の地に \`color-danger-text\`。確認のダイアログの中で使う |

## 大きさ

- sm: 高さ 28px、文字 13px。表の行の中、パネルの見出しの横
- md: 高さ 34px、文字 14px。標準
- lg: 高さ 44px、文字 15px。予約ページとアプリ(指で押す)

## 状態

通常、ホバー(\`-hover\`)、押下(\`-pressed\`)、フォーカス(\`color-focus-ring\` の 2px の線を 2px 離す)、無効(不透明度 45%)、読み込み中(文字の前に回る輪。押した文字は変えない)。

## 文言

動詞で終える短い日本語。「〜する」は付けない(「承認」「参加する」は例外として可。迷ったら動作が伝わる方)。英語の「OK」「Submit」は使わない。
`,
  body: [
    labeled("種類", `<div class="sl-line"><button class="sl-btn sl-btn--primary" type="button">承認</button><button class="sl-btn sl-btn--secondary" type="button">辞退</button><button class="sl-btn sl-btn--ghost" type="button">${icon("copy")}リンクをコピー</button><button class="sl-btn sl-btn--danger" type="button">予約をキャンセル</button></div>`),
    labeled("状態(通常・ホバー・押下・フォーカス・無効・読み込み中)", `<div class="sl-line"><button class="sl-btn sl-btn--primary" type="button">保存</button><button class="sl-btn sl-btn--primary is-hover" type="button">保存</button><button class="sl-btn sl-btn--primary is-active" type="button">保存</button><button class="sl-btn sl-btn--primary is-focus" type="button">保存</button><button class="sl-btn sl-btn--primary" type="button" disabled>保存</button><button class="sl-btn sl-btn--primary is-loading" type="button" aria-busy="true"><span class="sl-spinner" aria-hidden="true"></span>保存</button></div>`),
    labeled("大きさ(sm・md・lg)とアイコンだけ", `<div class="sl-line"><button class="sl-btn sl-btn--secondary sl-btn--sm" type="button">承認</button><button class="sl-btn sl-btn--secondary" type="button">承認</button><button class="sl-btn sl-btn--primary sl-btn--lg" type="button">${icon("video", 18)}参加する</button><button class="sl-btn sl-btn--ghost sl-btn--icon" type="button" aria-label="その他の操作">${icon("more", 18)}</button></div>`),
  ].join("\n"),
};

C.Input = {
  group: "入力",
  height: 250,
  readme: `# Input

1 行または複数行の文字を入れる欄。必ずラベルを付け、説明やエラーは欄の下に出す。

- 高さ 36px(アプリと予約ページは 44px)、角丸 \`radius-md\`、枠 \`color-border-control\`(地との差 3:1 以上)
- 入力例(placeholder)は \`color-text-subtle\`。ラベルの代わりにしない
- フォーカス: 枠と外側の 2px の線を \`color-focus-ring\` にする
- エラー: 枠を \`color-danger\` にし、欄の下に「何が違うか、どう直すか」を書く。例「メールアドレスの形が正しくありません(例: name@example.com)」
- 必須はラベルの横に「必須」と小さく書く。赤い * は使わない
- 無効: 地を \`color-surface\`、文字を \`color-text-subtle\`
`,
  body: [
    `<div class="sl-field"><label class="sl-label" for="i1">お名前 <small>必須</small></label><input class="sl-input" id="i1" placeholder="山田 太郎"></div>`,
    `<div class="sl-field"><label class="sl-label" for="i2">メールアドレス <small>必須</small></label><input class="sl-input is-focus" id="i2" value="yamada@example"><span class="sl-help">確認のメールをお送りします</span></div>`,
    `<div class="sl-field"><label class="sl-label" for="i3">メールアドレス</label><input class="sl-input" id="i3" value="yamada@example" aria-invalid="true" aria-describedby="i3e"><span class="sl-error-text" id="i3e">${icon("alert", 14)}メールアドレスの形が正しくありません</span></div>`,
    `<div class="sl-field"><label class="sl-label" for="i4">予約ページの URL</label><input class="sl-input sl-mono" id="i4" value="slotto.jp/misaki/intro" disabled></div>`,
    `<div class="sl-field" style="width: 576px"><label class="sl-label" for="i5">ご相談の内容</label><textarea class="sl-input" id="i5" placeholder="当日お話ししたいことがあればお書きください"></textarea></div>`,
  ].join("\n"),
};

C.Select = {
  group: "入力",
  height: 120,
  readme: `# Select

決まった選択肢から 1 つを選ぶ欄。見た目は Input と同じで、右端に下向きの矢印を置く。

- 選択肢が 2〜3 個で、すべてを見せたいときは Segment(Tabs の項)かラジオボタンにする
- 選択肢が 10 個を超えるとき(タイムゾーンなど)は、検索できる選択欄にする
- 所要時間の例: 15 分 / 30 分 / 45 分 / 60 分 / 任意
`,
  body: [
    `<div class="sl-field"><label class="sl-label" for="s1">所要時間</label><div class="sl-select"><select class="sl-input" id="s1"><option>15分</option><option selected>30分</option><option>45分</option><option>60分</option></select>${icon("chevD")}</div></div>`,
    `<div class="sl-field"><label class="sl-label" for="s2">タイムゾーン</label><div class="sl-select"><select class="sl-input" id="s2"><option>日本時間(GMT+09:00)</option></select>${icon("chevD")}</div></div>`,
  ].join("\n"),
};

C.Checkbox = {
  group: "入力",
  height: 150,
  readme: `# Checkbox

項目ごとに「入れる / 入れない」を選ぶ。取り込み画面で外部予定を選ぶのが主な使い道。

- 16px の四角、角丸 \`radius-sm\`。選ぶと \`color-primary\` で塗り、白い印を付ける
- 一部だけ選ばれている見出し(「10月5日(月)をすべて選ぶ」)は横線の印(indeterminate)
- ラベル全体を押せるようにする(\`label\` で包む)
- 押した結果は、すぐに件数(「3 件を選択中」)に反映する
`,
  body: [
    `<div class="sl-stack">
<label class="sl-check"><input type="checkbox" id="c0"><span>10月5日(月)をすべて選ぶ</span></label>
<label class="sl-check" style="padding-left: 24px"><input type="checkbox" checked><span class="sl-num">10:00–11:00 部内レビュー</span></label>
<label class="sl-check" style="padding-left: 24px"><input type="checkbox"><span class="sl-num">13:00–14:00 歯医者</span></label>
</div>`,
    `<div class="sl-stack"><label class="sl-check"><input type="checkbox" checked><span>新しい予定を自動で反映する</span></label><label class="sl-check"><input type="checkbox" disabled><span>祝日を除外する(無効)</span></label><label class="sl-check"><input type="checkbox" class="is-focus"><span>フォーカス</span></label></div>`,
  ].join("\n"),
  script: `document.getElementById('c0').indeterminate = true;`,
};

C.Switch = {
  group: "入力",
  height: 110,
  readme: `# Switch

押した瞬間に効く設定のオン・オフ。保存ボタンが要る設定には Checkbox を使う。

- 予約ページの「公開」、オートメーションの「有効」、カレンダーごとの「新しい予定を自動で反映」
- オフの地は \`color-border-control\`、オンは \`color-primary\`。つまみは白
- \`role="switch"\` を付け、ラベルは状態ではなく対象を書く(「公開」と書き、「オン」とは書かない)
`,
  body: `<div class="sl-stack"><label class="sl-switch"><input type="checkbox" role="switch" checked><span>公開</span></label><label class="sl-switch"><input type="checkbox" role="switch"><span>新しい予定を自動で反映</span></label><label class="sl-switch"><input type="checkbox" role="switch" checked disabled><span>無効のとき</span></label></div>`,
};

C.Tabs = {
  group: "ナビゲーション",
  height: 150,
  readme: `# Tabs

同じ画面の中で表示を切り替える。予約一覧の「これから / 承認待ち / 過去 / キャンセル」など。

- 選択中は文字を \`color-text\`、下に 2px の \`color-primary\` の線
- 件数は Count(小さな丸いバッジ)で添える。0 件のときは出さない
- Segment は表示の形を切り替えるとき(週 / 月、リスト / カレンダー)。地が動く小さな切り替え
`,
  body: [
    `<div style="width: 520px"><div class="sl-tabs" role="tablist"><button class="sl-tab" role="tab" aria-selected="true">これから <span class="sl-count">12</span></button><button class="sl-tab" role="tab" aria-selected="false">承認待ち <span class="sl-count">2</span></button><button class="sl-tab is-hover" role="tab" aria-selected="false">過去</button><button class="sl-tab" role="tab" aria-selected="false">キャンセル</button></div></div>`,
    labeled("Segment", `<div class="sl-segment" role="group" aria-label="表示"><button type="button" aria-pressed="false">日</button><button type="button" aria-pressed="true">週</button><button type="button" aria-pressed="false">月</button></div>`),
  ].join("\n"),
};

C.Badge = {
  group: "表示",
  height: 130,
  readme: `# Badge

状態を 1〜2 語で示す小さなラベル。色には必ず意味を持たせ、飾りに使わない。

| 種類 | 文言の例 |
|---|---|
| primary | 新着 |
| success | 確定、公開中 |
| warning | 承認待ち、一時停止中 |
| danger | キャンセル、失敗 |
| info | 同期中 |
| 無地 | 反映中、下書き、1 回限り |

- 地は \`*-soft\`、文字は同じ系統の濃い色(4.5:1 以上)
- 色だけに頼らず、文言で状態が分かるようにする
- 件数は Count を使う。サイドバーなど濃色の面の上では \`count--on-dark\`
- ショートカットのキーは Kbd で表す
`,
  body: [
    `<div class="sl-line"><span class="sl-badge sl-badge--primary">新着</span><span class="sl-badge sl-badge--success sl-badge--dot">確定</span><span class="sl-badge sl-badge--warning sl-badge--dot">承認待ち</span><span class="sl-badge sl-badge--danger sl-badge--dot">キャンセル</span><span class="sl-badge sl-badge--info">同期中</span><span class="sl-badge">反映中</span><span class="sl-badge sl-badge--outline">1 回限り</span></div>`,
    `<div class="sl-line"><span class="sl-count">4</span><span class="sl-count">12</span><span style="display: inline-flex; padding: 6px; border-radius: 6px; background: var(--color-sidebar)"><span class="sl-count sl-count--on-dark">2</span></span><span class="sl-kbd">Ctrl</span><span class="sl-kbd">K</span></div>`,
  ].join("\n"),
};

C.Avatar = {
  group: "表示",
  height: 110,
  readme: `# Avatar

人を示す丸。写真がなければ姓の 1 文字を出す(「佐藤 美咲」→「佐」)。

- 24 / 32 / 44px。一覧の行は 32px、予約ページのホストは 44px
- 地は予約ページの色の \`page-*-soft\`、文字は \`color-text\`。色は名前から決めて、同じ人はいつも同じ色にする
- 重ねて並べるときは、地の色で 2px の縁を付けて 6px 重ねる
`,
  body: `<div class="sl-line"><span class="sl-avatar sl-avatar--sm sl-tone-blue" aria-hidden="true">佐</span><span class="sl-avatar sl-tone-green" aria-hidden="true">高</span><span class="sl-avatar sl-tone-purple" aria-hidden="true">中</span><span class="sl-avatar sl-avatar--lg sl-tone-orange" aria-hidden="true">鈴</span><span class="sl-avatar-group"><span class="sl-avatar sl-tone-teal">山</span><span class="sl-avatar sl-tone-pink">小</span><span class="sl-avatar sl-tone-yellow">田</span></span></div>`,
};

C.Card = {
  group: "表示",
  height: 220,
  surface: true,
  readme: `# Card

\`color-surface\` の下地の上に、まとまりを 1 つ置く白い面。管理画面のホームのパネル、予約ページの一覧のカード。

- 地 \`color-bg\`、枠 \`color-border\` の 1px、角丸 \`radius-lg\`。影は付けない
- 見出しは 15px の太字。右端に「すべて見る」のようなリンクを 1 つまで
- 押せるカード(予約ページの一覧など)だけ、ホバーで枠を \`color-border-strong\` にして \`shadow-sm\` を足す
- カードの中にカードを入れない。左端に色の帯を付けない
`,
  body: [
    `<section class="sl-card" style="width: 340px"><div class="sl-card__head"><h3 class="sl-card__title">承認待ち</h3><span class="sl-count">2</span><a class="sl-card__link" href="#">すべて見る</a></div><div class="sl-card__body sl-note" style="font-size: 13px">いちばん早い申請: 10月6日(火) 15:00</div></section>`,
    `<a class="sl-card sl-card--interactive is-hover" href="#" style="width: 300px; display: block; text-decoration: none; color: inherit"><div class="sl-card__head"><span class="sl-avatar sl-avatar--sm sl-tone-blue" aria-hidden="true">初</span><h3 class="sl-card__title">初回お打ち合わせ</h3><span class="sl-badge sl-badge--success sl-badge--dot" style="margin-left: auto">公開中</span></div><div class="sl-card__body sl-line sl-note" style="font-size: 13px">${icon("clock", 14)}30分 ${icon("video", 14)}Google Meet</div></a>`,
  ].join("\n"),
};

C.Table = {
  group: "表示",
  height: 240,
  readme: `# Table

列で比べたい一覧。予約一覧(Web)、取り込み画面の外部予定、オートメーションの実行履歴。

- 見出しの行は 12px、\`color-text-muted\`、地は \`color-surface\`、下線は \`color-border-strong\`
- 行の上下は 10px。行を押すと右に詳細パネル(Sheet)を開き、その行を \`color-primary-soft\` にする
- 日時の列は等幅の数字(tabular-nums)。日付は「10月6日(火)」、時刻は「15:00–16:00」
- 幅が狭いときは、表をやめて List row に切り替える
`,
  body: `<table class="sl-table" style="width: 760px">
<thead><tr><th scope="col">日時</th><th scope="col">相手</th><th scope="col">予約ページ</th><th scope="col">状態</th></tr></thead>
<tbody>
<tr><td class="sl-num">10月6日(火) 15:00–16:00</td><td>中村 由紀さん<span class="sl-sub">合同会社ひかり</span></td><td>導入相談</td><td><span class="sl-badge sl-badge--warning sl-badge--dot">承認待ち</span></td></tr>
<tr aria-selected="true"><td class="sl-num">10月7日(水) 14:30–15:00</td><td>伊藤 誠さん<span class="sl-sub">株式会社ミライ</span></td><td>初回お打ち合わせ</td><td><span class="sl-badge sl-badge--success sl-badge--dot">確定</span></td></tr>
<tr class="is-hover"><td class="sl-num">10月8日(木) 10:30–11:00</td><td>小林 大輔さん<span class="sl-sub">個人</span></td><td>初回お打ち合わせ</td><td><span class="sl-badge sl-badge--warning sl-badge--dot">承認待ち</span></td></tr>
</tbody>
</table>`,
};

C.ListRow = {
  group: "表示",
  height: 290,
  readme: `# List row

時刻順の予定や予約を並べる行。管理画面のホーム、アプリの一覧、狭い幅の予約一覧。

- 左から: 時刻(開始を太く、終わりを弱く)、予約ページの色の細い帯、題名と相手、右端に場所や状態
- 行の高さは 52px 以上(アプリは 44px 以上を押せる範囲にする)
- 終わった予定は題名を \`color-text-muted\` に下げる。消さない
- 未読(新しく入った予約)は左端に \`color-primary\` の点
- 選択中は \`color-primary-soft\`。この上では \`color-text-subtle\` を使わない
`,
  body: `<div class="sl-list" style="width: 560px">
<a class="sl-item is-past" href="#"><div class="sl-item__time"><b>11:00</b><span>11:30</span></div><span class="sl-item__bar sl-tone-blue" aria-hidden="true"></span><div class="sl-item__main"><span class="sl-item__title">初回お打ち合わせ</span><span class="sl-item__sub">山本 一郎さん・株式会社アルファ</span></div><span class="sl-item__meta">${icon("video", 14)}Meet</span></a>
<a class="sl-item is-selected" href="#" aria-current="true"><div class="sl-item__time"><b>14:00</b><span>14:30</span></div><span class="sl-item__bar sl-tone-green" aria-hidden="true"></span><div class="sl-item__main"><span class="sl-item__title">採用面談</span><span class="sl-item__sub">高橋 健太さん</span></div><span class="sl-item__meta sl-num" style="color: var(--color-primary-ink); font-weight: 600">あと 25分</span></a>
<a class="sl-item is-hover is-unread" href="#"><div class="sl-item__time"><b>16:00</b><span>17:00</span></div><span class="sl-item__bar sl-tone-orange" aria-hidden="true"></span><div class="sl-item__main"><span class="sl-item__title">製品デモ</span><span class="sl-item__sub">鈴木 花子さん・みどり商事</span></div><span class="sl-item__meta">${icon("pin", 14)}対面</span></a>
<a class="sl-item" href="#"><div class="sl-item__time"><b>18:00</b><span>20:00</span></div><span class="sl-item__bar sl-tone-gray" aria-hidden="true"></span><div class="sl-item__main"><span class="sl-item__title">懇親会</span><span class="sl-item__sub">Google カレンダー「仕事」</span></div><span class="sl-badge">反映中</span></a>
</div>`,
};

C.EmptyState = {
  group: "表示",
  height: 250,
  readme: `# Empty state

一覧が空のときに、何が入る場所か、次に何をすればよいかを示す。

- アイコン 1 つ(丸い地の中)、見出し、説明 1〜2 文、操作 1〜2 個
- 説明は「何が起きるか」を書く。例「Google カレンダーをつなぐと、予定がここに並びます」
- 絵や大きなイラストは置かない
`,
  body: `<div class="sl-card" style="width: 420px"><div class="sl-empty" style="margin: 0 auto"><span class="sl-empty__icon">${icon("calendar", 22)}</span><h3 class="sl-empty__title">まだ予定がありません</h3><p class="sl-empty__text">Google カレンダーをつなぐと、予定がここに並びます。選んだ予定だけが空き時間の計算に使われます。</p><div class="sl-line"><button class="sl-btn sl-btn--primary" type="button">Google カレンダーをつなぐ</button></div></div></div>`,
};

C.Skeleton = {
  group: "表示",
  height: 200,
  readme: `# Skeleton

読み込み中に、これから出る中身の形を薄く見せる。0.3 秒以内に終わる読み込みには出さない。

- 地は \`color-surface-hover\`。ゆっくり明滅する(1.4 秒)。動きを減らす設定のときは止める
- 実物と同じ高さ・同じ並びにして、読み込み後に画面が跳ねないようにする
- 読み込み中であることを \`aria-busy="true"\` で伝える
`,
  body: `<div class="sl-list" style="width: 520px" aria-busy="true" aria-label="読み込み中">
${[0, 1, 2]
  .map(
    () => `<div class="sl-item" style="cursor: default"><div class="sl-stack" style="width: 44px; gap: 6px"><span class="sl-skel" style="height: 12px; width: 38px"></span><span class="sl-skel" style="height: 12px; width: 30px"></span></div><span class="sl-skel" style="width: 4px; align-self: stretch"></span><div class="sl-stack" style="flex: 1; gap: 8px"><span class="sl-skel" style="height: 14px; width: 45%"></span><span class="sl-skel" style="height: 12px; width: 65%"></span></div></div>`,
  )
  .join("\n")}
</div>`,
};

C.Dialog = {
  group: "重なり",
  height: 300,
  readme: `# Dialog

作業を止めて確かめるための小さな窓。取り消せない操作の確認と、短い入力だけに使う。

- 幅 440px、地 \`color-surface-raised\`、角丸 \`radius-lg\`、影 \`shadow-lg\`。後ろに \`color-overlay\`
- 題名は「何をするか」を問いの形で。本文に結果を具体的に書く(誰に何が届くか)
- ボタンは右下。右端が実行(危険な操作は danger)、その左に「戻る」
- Esc と後ろの幕を押すと閉じる。開いたら最初の操作できる部品にフォーカスを移す
`,
  body: `<div class="sl-overlay" style="width: 100%; min-height: 260px; border-radius: 10px"><div class="sl-dialog" role="dialog" aria-modal="true" aria-labelledby="d1"><div class="sl-dialog__head"><h2 class="sl-dialog__title" id="d1">この予約をキャンセルしますか?</h2><button class="sl-btn sl-btn--ghost sl-btn--icon sl-btn--sm" type="button" aria-label="閉じる">${icon("x")}</button></div><div class="sl-dialog__body">10月7日(水) 14:30–15:00 の伊藤 誠さんとの予約を取り消します。伊藤さんにキャンセルのメールが届きます。</div><div class="sl-dialog__foot"><button class="sl-btn sl-btn--secondary" type="button">戻る</button><button class="sl-btn sl-btn--danger" type="button">キャンセルする</button></div></div></div>`,
  surface: true,
};

C.Sheet = {
  group: "重なり",
  height: 470,
  readme: `# Sheet

一覧の右から出る詳細パネル。一覧を見ながら 1 件の中身を確かめ、操作する。

- 幅 400px(\`layout-panel-width\`)、地 \`color-surface-raised\`、左に 1px の線と \`shadow-lg\`
- 見出しの行(高さ 56px)に題名と閉じるボタン。下に操作の行を固定する
- 中身は「項目名 / 値」の 2 列(\`sl-dl\`)で揃える
- 幅が 1024px 未満のときは、画面いっぱいに重ねて出す
`,
  body: `<div style="width: 100%; height: 430px; display: flex; justify-content: flex-end; background: var(--color-surface); border-radius: 10px; overflow: hidden"><aside class="sl-sheet" aria-label="予約の詳細"><div class="sl-sheet__head"><span class="sl-badge sl-badge--success sl-badge--dot">確定</span><span style="font-weight: 600; flex: 1">初回お打ち合わせ</span><button class="sl-btn sl-btn--ghost sl-btn--icon sl-btn--sm" type="button" aria-label="閉じる">${icon("x")}</button></div><div class="sl-sheet__body"><div class="sl-line"><span class="sl-avatar sl-tone-teal" aria-hidden="true">伊</span><div class="sl-stack" style="gap: 0"><span style="font-weight: 500">伊藤 誠さん</span><span class="sl-note" style="font-size: 13px">株式会社ミライ・makoto.ito@example.com</span></div></div><dl class="sl-dl"><dt>日時</dt><dd class="sl-num">10月7日(水) 14:30–15:00</dd><dt>場所</dt><dd><a href="#" style="color: var(--color-primary-ink)">Google Meet に参加</a></dd><dt>ご相談の内容</dt><dd>来期から営業部 20 名で使える日程調整の方法を探しています。</dd><dt>受付</dt><dd class="sl-num">10月2日(金) 13:12</dd></dl></div><div class="sl-sheet__foot"><button class="sl-btn sl-btn--secondary" type="button">日程の変更を依頼</button><button class="sl-btn sl-btn--ghost" type="button" style="margin-left: auto; color: var(--color-danger)">キャンセル</button></div></aside></div>`,
};

C.Toast = {
  group: "重なり",
  height: 140,
  readme: `# Toast

操作の結果を画面の下に短く知らせる。4 秒で消える(操作ボタンがあるときは 6 秒)。

- 地は \`color-sidebar\`(ライトでもダークでも濃色)、文字は白。アイコンと操作の文字は \`color-sidebar-accent\`
- 文言は結果を過去形で。「リンクをコピーしました」「3 件の予定を反映しました」
- 取り消せる操作には「元に戻す」を付ける
- 失敗は danger の地にし、原因と次の手を書く。自動では消さない
`,
  body: `<div class="sl-stack" style="gap: 10px"><div class="sl-toast" role="status">${icon("check", 18)}<span>3 件の予定を反映しました</span><button class="sl-toast__action" type="button">元に戻す</button></div><div class="sl-toast sl-toast--danger" role="alert">${icon("alert", 18)}<span>Google カレンダーにつながりません。連携をつなぎ直してください</span><button class="sl-toast__action" type="button">連携を開く</button></div></div>`,
};

C.Tooltip = {
  group: "重なり",
  height: 90,
  readme: `# Tooltip

アイコンだけのボタンの名前と、ショートカットを示す。説明文を入れる場所にはしない。

- 地 \`color-sidebar\`、文字 12px の白。カーソルを載せて 400ms 後に出し、キーボードのフォーカスでも出す
- ショートカットは Kbd で添える
`,
  body: `<div class="sl-line" style="gap: 24px"><span class="sl-tooltip" role="tooltip">検索 <span class="sl-kbd">Ctrl K</span></span><span class="sl-tooltip" role="tooltip">サイドバーを畳む <span class="sl-kbd">[</span></span><span class="sl-tooltip" role="tooltip">リンクをコピー</span></div>`,
};

function monthCells(selected, open, today) {
  const cells = ['<span aria-hidden="true"></span>', '<span aria-hidden="true"></span>', '<span aria-hidden="true"></span>', '<span aria-hidden="true"></span>'];
  for (let d = 1; d <= 31; d++) {
    if (d === selected) cells.push(`<button class="sl-day" type="button" aria-pressed="true" aria-label="10月${d}日">${d}</button>`);
    else if (open.has(d)) cells.push(`<button class="sl-day sl-day--open${d === 14 ? " is-hover" : ""}" type="button" aria-label="10月${d}日">${d}</button>`);
    else cells.push(`<button class="sl-day${d === today ? " sl-day--today" : ""}" type="button" disabled aria-label="10月${d}日(受付なし)">${d}</button>`);
  }
  return cells.join("");
}

C.MonthCalendar = {
  group: "日程",
  height: 400,
  readme: `# Month calendar

ゲストが日付を選ぶ月のカレンダー。予約ページの中心の部品。

- 日付は 40px の丸。受付のある日は \`color-primary-soft\` の地に \`color-primary-ink\` の太字、選んだ日は \`color-primary\` の地
- 受付のない日は \`color-text-subtle\` で、押せない(\`disabled\`)。今日は下に小さな点
- 週は日曜はじまり。曜日の行は \`color-text-muted\`
- 前の月に受付がなければ「前の月」を弱く出す。最初に開いたときは、いちばん早く受け付けている月を出す
- 下にタイムゾーンを出し、押すと変えられる
`,
  body: `<div class="sl-month"><div class="sl-month__head"><span class="sl-month__title">2026年10月</span><div class="sl-line" style="gap: 4px"><button class="sl-btn sl-btn--ghost sl-btn--icon sl-btn--sm" type="button" aria-label="前の月" style="color: var(--color-text-subtle)">${icon("chevL", 18)}</button><button class="sl-btn sl-btn--ghost sl-btn--icon sl-btn--sm" type="button" aria-label="次の月" style="color: var(--color-primary-ink)">${icon("chevR", 18)}</button></div></div><div class="sl-month__grid">${["日", "月", "火", "水", "木", "金", "土"].map((w) => `<span class="sl-month__wd">${w}</span>`).join("")}${monthCells(7, new Set([5, 6, 8, 13, 14, 15, 16, 19, 20, 22, 23, 26, 27, 28, 29, 30]), 2)}</div><button class="sl-btn sl-btn--ghost sl-btn--sm" type="button" style="align-self: flex-start; padding: 0 4px">${icon("globe")}日本時間(GMT+09:00)${icon("chevD", 14)}</button></div>`,
};

C.TimeSlot = {
  group: "日程",
  height: 300,
  readme: `# Time slot

選んだ日の、予約できる開始時刻のボタン。縦に並べる。

- 高さ 42px、枠 \`color-border-strong\`、文字は \`color-primary-ink\` の太字で等幅の数字
- ホバーで枠を \`color-primary\`、地を \`color-primary-soft\`。選ぶと \`color-primary\` で塗る
- 選んだら、下(スマホでは画面の下に固定)に「10月7日(水) 14:30–15:00 を選択中」と「次へ」を出す
- 直前に埋まった枠は打ち消し線と点線の枠にして押せなくし、「この枠は埋まりました」と知らせる
`,
  body: `<div class="sl-stack"><span style="font-weight: 500" class="sl-num">10月7日(水)</span><div class="sl-slots"><button class="sl-slot" type="button">10:00</button><button class="sl-slot is-hover" type="button">10:30</button><button class="sl-slot" type="button" disabled aria-label="11:00(埋まりました)">11:00</button><button class="sl-slot" type="button" aria-pressed="true">14:30</button><button class="sl-slot" type="button">15:00</button></div></div>`,
};

C.EventChip = {
  group: "日程",
  height: 150,
  readme: `# Event chip

カレンダーの中の予定 1 件。色は予約ページの色(\`page-*\`)。

| 種類 | 見た目 |
|---|---|
| 予約(確定) | \`page-*-soft\` の地、先頭に \`page-*\` の点 |
| 予約(承認待ち) | 白地に \`page-*\` の点線の枠 |
| 反映中の外部予定 | \`color-surface-hover\` の地、中抜きの点、文字は \`color-text-muted\` |
| 終わった予定 | 不透明度 70% |

- 題名を 1 行目、時刻を 2 行目。30 分未満の短い予定は 1 行にまとめる
- 文字は \`color-text\`(どの色の地でも 4.5:1 以上になるよう、地の色を決めてある)
`,
  body: `<div class="sl-line" style="align-items: stretch">
<div class="sl-event sl-tone-green" style="width: 150px"><span class="sl-event__title">採用面談</span><span class="sl-event__time">14:00–14:30</span></div>
<div class="sl-event sl-event--pending sl-tone-purple" style="width: 150px"><span class="sl-event__title">導入相談</span><span class="sl-event__time">承認待ち・15:00</span></div>
<div class="sl-event sl-event--external" style="width: 150px"><span class="sl-event__title">週次定例</span><span class="sl-event__time">09:30–10:00</span></div>
<div class="sl-event sl-event--past sl-tone-blue" style="width: 150px"><span class="sl-event__title">初回お打ち合わせ</span><span class="sl-event__time">11:00–11:30</span></div>
</div>
<div class="sl-line">${["blue", "green", "teal", "purple", "pink", "orange", "yellow", "gray"].map((t) => `<div class="sl-event sl-tone-${t}" style="width: 88px"><span class="sl-event__title">${t}</span></div>`).join("")}</div>`,
};

function weekBody() {
  const start = 9; // 9:00 から 15:00 まで
  const hours = 6;
  const px = 48;
  const y = (h, m = 0) => (h - start + m / 60) * px;
  const days = [
    ["月", 5, false],
    ["火", 6, false],
    ["水", 7, true],
    ["木", 8, false],
    ["金", 9, false],
  ];
  const ev = {
    5: [["external", "", "部内レビュー", "10:00–11:00", y(10), px]],
    6: [["pending", "purple", "導入相談", "13:00 承認待ち", y(13), px], ["", "blue", "初回お打ち合わせ", "10:30–11:00", y(10, 30), px / 2]],
    7: [["", "blue", "初回お打ち合わせ", "14:30–15:00", y(14, 30), px / 2], ["external", "", "週次定例", "09:30–10:00", y(9, 30), px / 2]],
    8: [["pending", "blue", "初回お打ち合わせ", "10:30 承認待ち", y(10, 30), px / 2], ["", "orange", "製品デモ", "13:00–14:00", y(13), px]],
    9: [["external", "", "1on1(田中さん)", "09:00–09:30", y(9), px / 2], ["", "green", "採用面談", "11:00–12:00", y(11), px]],
  };
  const chip = ([kind, tone, title, time, top, h]) =>
    `<div class="sl-event${kind ? ` sl-event--${kind}` : ""}${tone ? ` sl-tone-${tone}` : ""}" style="top: ${top + 1}px; height: ${h - 2}px"><span class="sl-event__title">${title}</span>${h >= px ? `<span class="sl-event__time">${time}</span>` : ""}</div>`;
  const head = days.map(([w, d, today]) => `<div class="sl-week__head${today ? " is-today" : ""}"><b>${d}</b>${w}</div>`).join("");
  const hourLabels = Array.from({ length: hours }, (_, i) => (i ? `<span class="sl-week__hour" style="top: ${i * px}px">${start + i}:00</span>` : "")).join("");
  const cols = days
    .map(([, d, today]) => `<div class="sl-week__col" style="height: ${hours * px}px">${ev[d].map(chip).join("")}${today ? `<span class="sl-week__now" style="top: ${y(11, 20)}px" aria-label="現在 11:20"></span>` : ""}</div>`)
    .join("");
  return `<div class="sl-week" style="width: 760px"><div class="sl-week__corner"></div>${head}<div class="sl-week__hours" style="height: ${hours * px}px">${hourLabels}</div>${cols}</div>`;
}

C.WeekCalendar = {
  group: "日程",
  height: 400,
  readme: `# Week calendar

ホストの統合カレンダー(週表示)。予約と、反映中の外部予定を同じ面に並べる。

- 1 時間 48px。横の線は \`color-border\`。左に時刻(11px、\`color-text-muted\`)
- 見出しは日付を大きく、曜日を小さく。今日の日付は \`color-primary-ink\`
- 現在時刻は \`color-primary\` の 2px の線と点
- 予定は Event chip。重なる予定は横に並べて幅を分ける
- 選んでいない外部予定は出さない(取り込み画面で選んだものだけが並ぶ)
`,
  body: weekBody(),
};

// ---------- 表紙 ----------

const cover = `<!-- @dsCard height=288 -->
<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>Slotto Design System</title>
<style>
body { margin: 0; background: var(--color-bg); }
.cv { position: relative; width: 960px; height: 288px; overflow: hidden; background: var(--color-bg); font-family: var(--font-sans); }
.cv svg { position: absolute; left: 0; top: 0; }
.slab { fill: var(--color-sidebar); }
[data-theme="dark"] .slab { fill: var(--color-sidebar-active); }
.blue { fill: var(--color-primary); }
.tint { fill: var(--color-primary-soft); }
.light { fill: var(--color-sidebar-accent); }
.slot { fill: var(--color-sidebar-active); rx: var(--radius-md); ry: var(--radius-md); }
[data-theme="dark"] .slot { fill: var(--color-sidebar-hover); }
.slot.on { fill: var(--color-sidebar-accent); }
.cv-text { position: absolute; left: 40px; bottom: 36px; width: 420px; display: flex; flex-direction: column; gap: 12px; }
.cv-name { margin: 0; font-size: 112px; line-height: 0.95; font-weight: 600; letter-spacing: -0.03em; color: var(--color-text); }
.cv-tag { margin: 0; font-size: 14px; line-height: 22px; color: var(--color-text-muted); }
</style></head>
<body>
<div class="cv">
<!--
  blocks: color-sidebar 272×288(縦の板)、color-primary 192×136、color-primary-soft 96×136、color-sidebar-accent 80×136
  arrangement: 縦の板を 1 枚、右に小さな板を 3 枚。上下と右は枠の外まで伸ばす
  pattern: 予約枠のボタン(radius-md の角丸の帯)を板の上に 2 列 7 段。日程調整の「時間枠の列」をそのまま形にした
  steps & radii: 帯 96×20、列の間 16、段の間 32(space-8)、角丸 radius-md
-->
<svg width="960" height="288" viewBox="0 0 960 288" aria-hidden="true">
<rect class="slab" x="480" y="0" width="272" height="288"/>
<rect class="blue" x="768" y="0" width="192" height="136"/>
<rect class="tint" x="768" y="152" width="96" height="136"/>
<rect class="light" x="880" y="152" width="80" height="136"/>
${Array.from({ length: 14 }, (_, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const on = i === 5 || i === 8;
  return `<rect class="slot${on ? " on" : ""}" x="${512 + col * 112}" y="${36 + row * 32}" width="96" height="20"/>`;
}).join("\n")}
</svg>
<div class="cv-text">
<h1 class="cv-name">Slotto</h1>
<p class="cv-tag">毎日開く日程調整の道具として、落ち着いていて迷わない見た目</p>
</div>
</div>
</body>
</html>
`;

// ---------- README ----------

const readme = `# Slotto

Slotto(スロットー)は、空き時間を共有して相手に予約してもらう日程調整サービス。Web(紹介サイト、ホストの管理画面、ゲストの予約ページ)と、ホスト用のモバイルアプリがある。このデザインシステムは両方で同じ値を使う。

## 狙う印象

「毎日開く仕事道具」として信頼できること。落ち着いていて、密度があり、迷わない。装飾ではなく、整った余白と書体と色の使い分けで洗練を出す。

- 濃い紺のサイドバーと、明るい作業面の対比
- 主色の青は要所だけ(主なボタン、選択中、現在時刻)。1 画面に数か所
- 区切りは細い線と面の色差。影は浮いているもの(ダイアログ、メニュー)だけ
- 情報の密度はあるが、行間と余白で読みやすく
- 状態の変化が分かる、短い動き(100〜240ms、ease-out)

## 表記と文言

- サービス名は「Slotto」、ロゴは小文字の「slotto」。カタカナの「スロット」は前面に出さない
- 短く具体的な日本語。英語の直訳、絵文字、感嘆符は使わない
- ボタンは動作を書く(「承認」「次へ」「リンクをコピー」)。結果は過去形で知らせる(「リンクをコピーしました」)
- エラーは原因と直し方を書く。謝罪の言葉で埋めない
- 日付は「10月6日(火)」、時刻は 24 時間表記の「15:00–16:00」(間は en ダッシュ)。件数は「4件」「あと 25分」
- 相手の名前には「さん」を付ける(「高橋 健太さん」)。ゲスト向けの画面は丁寧語

## 色

役割で名前を付けている。値はライトとダークの 2 組(Colors を参照)。

| 役割 | トークン | 使い方 |
|---|---|---|
| 作業面 | \`color-bg\` / \`color-surface\` | パネルとカードは \`color-bg\`、その下地が \`color-surface\` |
| 浮いた面 | \`color-surface-raised\` | ダイアログ、メニュー、詳細パネル |
| サイドバー | \`color-sidebar\` 系 | ライトでもダークでも濃色。トースト、ツールチップ、アプリの「次の予定」カードにも使う |
| 主色 | \`color-primary\` 系 | 主なボタン、選択中、現在時刻。文字には \`color-primary-ink\` |
| 文字 | \`color-text\` / \`-muted\` / \`-subtle\` | 本文 / 補足 / 終わった予定や受付のない日。subtle は \`color-primary-soft\` の上に置かない |
| 線 | \`color-border\` / \`-strong\` / \`-control\` | 区切り / 副ボタンの枠 / 入力欄の枠(地との差 3:1 以上) |
| 状態 | \`color-success\` \`warning\` \`danger\` \`info\` と \`*-soft\` | 確定・公開中 / 承認待ち / キャンセル・エラー / 同期中 |
| 予約ページの色 | \`page-blue\` ほか 8 色と \`*-soft\` | 予約ページごとの色。予定の点や帯、チップの地。状態の意味には使わない |

- 文字と地の組み合わせは、ライトとダークの両方で WCAG AA(本文 4.5:1、大きい文字と図形 3:1)を満たすことを、トークンを作るスクリプトで確かめている
- 色だけで状態を伝えない。必ず文言か形(点線の枠など)を添える
- フォーカスは \`color-focus-ring\` の 2px の線を 2px 離して描く。消さない

## 書体

- 欧文は **Geist**、和文は **Noto Sans JP**(どちらも SIL Open Font License、Google Fonts で読み込む)。コードと URL は **Geist Mono**
- アプリ(Expo)は端末の書体(iOS はヒラギノ角ゴシックと SF、Android は Noto Sans CJK と Roboto)を使う。大きさと太さはこのシステムに合わせる
- 時刻と件数は必ず等幅の数字(\`font-variant-numeric: tabular-nums\`)。桁が揃うこと
- 管理画面の本文は 14px、予約ページとアプリの本文は 15px。12px より小さい文字は使わない
- 見出しは 600(semibold)。大きい見出しほど字間を詰める(-0.01〜-0.02em)。和文の本文の字間は 0

## 余白、角丸、影、線

- 余白は 4px 刻み(\`space-1\` = 4px … \`space-24\` = 96px)。パネルの内側 16px、パネルどうしの間 18〜24px
- 角丸は小さめ: \`radius-sm\` 4px(バッジ)、\`radius-md\` 6px(ボタン、入力欄)、\`radius-lg\` 10px(パネル、ダイアログ)、\`radius-xl\` 14px(アプリのカード)
- 線は 1px。フォーカスと選択中のタブの下線だけ 2px
- 影は 3 段(\`shadow-sm\` / \`md\` / \`lg\`)。カードには付けない

## 動き

- 速さ: 100ms(色の変化)、160ms(スイッチ、パネルの開閉)、240ms(画面の切り替え)。イージングは \`cubic-bezier(0.2, 0.8, 0.2, 1)\`
- 動きを減らす設定(\`prefers-reduced-motion\`)のときは、移動と明滅を止める
- 意味のない大きな動きは付けない。状態が変わったことを小さく知らせる

## アイコン

- 線のアイコン。24px の枠、線の太さ 1.75、角は丸。実装では **Lucide** を使う(Web は \`lucide-react\`、アプリは \`lucide-react-native\`)
- 文字の横に置くときは 16px、ナビゲーションは 18〜24px。色は横の文字と同じ
- アイコンだけのボタンには \`aria-label\` とツールチップを付ける
- 絵文字は UI に使わない

## ロゴ

ロゴは小文字の「slotto」を線で組んだもの。2 つ並んだ「t」の横棒を 1 本の帯でつなぎ、予約枠(時間の帯)に見立てている。帯だけ主色にする。

- 明るい地: 文字 \`color-text\`(#121826)、帯 \`color-primary\`(#2456D3)→ \`slotto-wordmark.svg\`
- 濃い地: 文字 白、帯 \`color-sidebar-accent\`(#87B1FD)→ \`slotto-wordmark-on-dark.svg\`
- 1 色で刷るとき: 帯も文字と同じ色 → \`slotto-wordmark-mono.svg\`
- 周りの余白は「o」の高さ以上。高さ 16px 未満では使わず、記号(\`slotto-symbol.svg\`)にする
- 変形、色の入れ替え、影や縁取り、帯以外の部分の色替えはしない

## アプリアイコン

ロゴの「tt」と帯だけを取り出した形。**青の地(\`app-icon-blue.svg\`)に決定**(2026-10-03)。青 #2456D3 の地に白の「tt」、帯は紺 #131B31。紺の地の案(\`app-icon-navy.svg\`)は不採用として残す。角丸は OS がかけるので、SVG は正方形いっぱいに描いてある。

## 部品

Components に、部品ごとの見本と使い方がある。\`components/bundle.css\` は見本用の CSS で、すべての値をトークンの CSS 変数から取っている。

- 操作: Button
- 入力: Input、Select、Checkbox、Switch
- ナビゲーション: Tabs(Segment を含む)
- 表示: Badge(Count、Kbd を含む)、Avatar、Card、Table、List row、Empty state、Skeleton
- 重なり: Dialog、Sheet(横から出るパネル)、Toast、Tooltip
- 日程: Month calendar、Time slot、Week calendar、Event chip

すべての部品で、通常・ホバー・フォーカス・押下・無効・読み込み中・エラーの見え方を決めている(部品に当てはまるものだけ)。

## コードでの使い方

トークンはリポジトリの \`packages/tokens\` にある。このシステムの tokens.json と同じ元(\`design/tokens/source.mjs\`)から生成している。

- Web: \`import "@slotto/tokens/tokens.css"\`。書体は \`next/font/google\` で Geist、Noto Sans JP、Geist Mono を読み込み、\`--font-sans\` と \`--font-mono\` をその書体で上書きする。ライトは \`:root\`、ダークは \`.dark\` のクラス。CSS 変数の名前はこのシステムのトークン名と同じ(\`--color-primary\`、\`--space-4\`、\`--radius-md\`)
- アプリ: \`import { color, space, radius, textStyle } from "@slotto/tokens"\`。\`color.light.textMuted\` のように camelCase
`;

const logosReadme = `# Logos

- slotto-wordmark.svg: 明るい地のロゴ。文字 #121826、帯 #2456D3
- slotto-wordmark-on-dark.svg: 濃い地のロゴ。文字 白、帯 #87B1FD
- slotto-wordmark-mono.svg: 1 色。#121826
- slotto-symbol.svg / slotto-symbol-on-dark.svg: 記号(「tt」と帯)。高さ 16px 未満やアバターの代わりに使う

元のファイルはリポジトリの design/logo/ にある(design/logo/build.mjs で生成)。
`;

const iconsReadme = `# App icons

- app-icon-blue.svg: 採用(2026-10-03)。青(#2456D3)の地に白の「tt」、帯は #131B31
- app-icon-navy.svg: 不採用の案。紺(#131B31)の地に白の「tt」、帯は #87B1FD

正方形いっぱいに描いてある。角丸は iOS と Android がかける。書き出しは 1024 × 1024。
`;

// ---------- 書き出し ----------

write("README.md", readme);
write("components/bundle.css", readFileSync(join(here, "components.css"), "utf8"));
write("components/Cover/preview.html", cover);
write("assets/Logos/README.md", logosReadme);
write("assets/AppIcons/README.md", iconsReadme);
for (const [name, c] of Object.entries(C)) {
  write(`components/${name}/README.md`, c.readme);
  write(`components/${name}/preview.html`, preview({ group: c.group, height: c.height, title: name, body: c.body, surface: c.surface, script: c.script }));
}
console.log("wrote README, cover and", Object.keys(C).length, "components to", project);
