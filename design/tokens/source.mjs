// Slotto のデザイントークンの元。ここだけを書き換え、build.mjs で次を生成する。
//   - packages/tokens/src/tokens.css(Web 用の CSS 変数)
//   - packages/tokens/src/index.ts(アプリ用の値)
//   - Design System(Claude Design)の tokens.json
// 方向: 2026-10-03 に A 案「ミッドナイト」(紺のサイドバー + 青、Geist + Noto Sans JP)に決定。
//
// 色は [ライト, ダーク]。それぞれ HEX / rgba() の文字列か、OKLCH の [明度, 彩度, 色相]。

const W = "#FFFFFF";
const INK = [0.17, 0.03, 265]; // ダークで、明るい面に載せる文字の色

// 役割の色。名前は CSS では --color-<名前>、TS では color.light.<camelCase>
export const color = {
  // 面
  bg: { value: [W, [0.19, 0.014, 265]], usage: "作業面とパネルの地。カード、一覧、入力欄の中" },
  surface: { value: [[0.975, 0.004, 265], [0.155, 0.012, 265]], usage: "作業面の下地。管理画面の右側、予約ページの背景" },
  "surface-raised": { value: [W, [0.235, 0.016, 265]], usage: "浮いた面。ダイアログ、メニュー、横から出るパネル" },
  "surface-hover": { value: [[0.955, 0.006, 265], [0.26, 0.016, 265]], usage: "行やボタンにカーソルを載せたときの地。読み込み中の骨組み" },
  overlay: { value: ["rgba(15, 20, 35, 0.48)", "rgba(0, 0, 0, 0.6)"], usage: "ダイアログの後ろを暗くする幕" },

  // サイドバー(ライトでも濃色)
  sidebar: { value: [[0.225, 0.045, 268], [0.135, 0.02, 268]], usage: "サイドバーの地。アプリの「次の予定」カード、トースト、ツールチップの地にも使う" },
  "sidebar-hover": { value: [[0.27, 0.052, 268], [0.19, 0.026, 268]], usage: "サイドバーの項目にカーソルを載せたとき" },
  "sidebar-active": { value: [[0.31, 0.06, 268], [0.245, 0.036, 268]], usage: "サイドバーの選択中の項目" },
  "sidebar-border": { value: [[0.31, 0.04, 268], [0.23, 0.02, 268]], usage: "サイドバーの中の区切り線" },
  "sidebar-text": { value: [[0.82, 0.025, 265], [0.8, 0.018, 265]], usage: "サイドバーの文字" },
  "sidebar-text-active": { value: [W, W], usage: "サイドバーの選択中の文字" },
  "sidebar-text-muted": { value: [[0.68, 0.03, 265], [0.64, 0.02, 265]], usage: "サイドバーの見出し、補助の文字、アイコン" },
  "sidebar-accent": { value: [[0.76, 0.12, 262], [0.76, 0.12, 262]], usage: "濃色の面の上の主色。件数のバッジ、「あと 25 分」" },

  // 主色
  primary: { value: [[0.5, 0.2, 264], [0.7, 0.14, 262]], usage: "主なボタン、選択中の日付と時間枠、現在時刻の線。1 画面に数か所だけ" },
  "primary-hover": { value: [[0.44, 0.19, 264], [0.76, 0.12, 262]], usage: "主なボタンにカーソルを載せたとき" },
  "primary-pressed": { value: [[0.39, 0.17, 264], [0.81, 0.1, 262]], usage: "主なボタンを押している間" },
  "primary-text": { value: [W, INK], usage: "primary の上の文字" },
  "primary-soft": { value: [[0.955, 0.025, 264], [0.27, 0.06, 264]], usage: "選べる日付、選択中の行、件数のバッジの地" },
  "primary-ink": { value: [[0.46, 0.19, 264], [0.8, 0.1, 262]], usage: "主色の文字。リンク、primary-soft の上の文字" },

  // 文字と線
  text: { value: [[0.21, 0.03, 268], [0.95, 0.006, 265]], usage: "本文と見出し" },
  "text-muted": { value: [[0.47, 0.03, 265], [0.76, 0.018, 265]], usage: "補足の文字。相手の会社名、時刻の終わり" },
  "text-subtle": { value: [[0.54, 0.025, 265], [0.67, 0.018, 265]], usage: "さらに弱い文字。終わった予定、受付のない日付。primary-soft の上には使わない" },
  "text-inverse": { value: [W, INK], usage: "text の色を地にしたときの文字" },
  border: { value: [[0.925, 0.006, 265], [0.285, 0.014, 265]], usage: "区切り線、パネルの枠" },
  "border-strong": { value: [[0.85, 0.012, 265], [0.37, 0.018, 265]], usage: "副ボタンの枠、表の見出しの下線" },
  "border-control": { value: [[0.64, 0.02, 265], [0.55, 0.02, 265]], usage: "入力欄、チェックボックス、スイッチの枠。地との差 3:1 以上" },
  "focus-ring": { value: [[0.55, 0.2, 264], [0.74, 0.13, 262]], usage: "キーボード操作中の輪郭。2px の線を 2px 離して描く" },

  // 状態
  success: { value: [[0.5, 0.12, 155], [0.76, 0.14, 155]], usage: "成功、確定、公開中" },
  "success-soft": { value: [[0.96, 0.03, 155], [0.27, 0.045, 155]], usage: "success のバッジと通知の地" },
  warning: { value: [[0.5, 0.11, 70], [0.81, 0.13, 78]], usage: "注意、承認待ち、一時停止中" },
  "warning-soft": { value: [[0.96, 0.04, 85], [0.28, 0.045, 78]], usage: "warning のバッジと通知の地" },
  danger: { value: [[0.52, 0.19, 27], [0.71, 0.16, 25]], usage: "危険、エラー、キャンセル、削除" },
  "danger-hover": { value: [[0.46, 0.18, 27], [0.76, 0.14, 25]], usage: "危険なボタンにカーソルを載せたとき" },
  "danger-text": { value: [W, INK], usage: "danger の上の文字" },
  "danger-soft": { value: [[0.96, 0.02, 27], [0.28, 0.05, 25]], usage: "danger のバッジと通知の地" },
  info: { value: [[0.5, 0.13, 240], [0.77, 0.11, 238]], usage: "お知らせ。同期中など" },
  "info-soft": { value: [[0.96, 0.02, 240], [0.27, 0.045, 238]], usage: "info のバッジと通知の地" },
};

// 予約ページの色分け。-soft は予定のチップの地(上に text の色の文字を載せる)
export const pageHues = {
  blue: 252,
  green: 158,
  teal: 200,
  purple: 295,
  pink: 350,
  orange: 50,
  yellow: 85,
  gray: 265,
};
export const page = Object.fromEntries(
  Object.entries(pageHues).flatMap(([name, h]) => {
    const gray = name === "gray";
    const yellow = name === "yellow";
    return [
      [name, { value: [[yellow ? 0.58 : 0.56, gray ? 0.02 : 0.14, h], [0.74, gray ? 0.02 : 0.12, h]], usage: `予約ページの色「${name}」。点、細い帯、グラフ` }],
      [`${name}-soft`, { value: [[0.95, gray ? 0.008 : 0.035, h], [0.3, gray ? 0.012 : 0.05, h]], usage: `「${name}」の予定のチップの地` }],
    ];
  }),
);

// 書体
export const font = {
  url: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500;600;700&display=swap",
  sans: "Geist, \"Noto Sans JP\", \"Hiragino Sans\", \"Yu Gothic UI\", system-ui, sans-serif",
  mono: "\"Geist Mono\", ui-monospace, \"SFMono-Regular\", Menlo, monospace",
  // アプリは端末の書体を使う(Expo で Web フォントを読むのは任意)
  native: { sans: "System", mono: "Menlo" },
};

// 文字の大きさ(px)。管理画面の本文は base、アプリと予約ページの本文は md
export const fontSize = { xs: 12, sm: 13, base: 14, md: 15, lg: 17, xl: 20, "2xl": 24, "3xl": 30, "4xl": 38, "5xl": 48 };
export const lineHeight = { tight: 1.25, snug: 1.4, normal: 1.6, relaxed: 1.8 };
export const fontWeight = { regular: 400, medium: 500, semibold: 600, bold: 700 };
export const letterSpacing = { tight: "-0.02em", snug: "-0.01em", normal: "0em", wide: "0.04em" };

// 文字の組み(デザインシステムの Typography に出す)
export const textStyles = [
  { group: "見出し", name: "display", fontSize: 48, lineHeight: 56, fontWeight: 600, letterSpacing: "-0.02em", sample: "空き時間を送るだけ", usage: "紹介サイトのファーストビューだけ" },
  { group: "見出し", name: "title-1", fontSize: 30, lineHeight: 40, fontWeight: 600, letterSpacing: "-0.02em", sample: "使い方は 3 ステップ", usage: "紹介サイトの章の見出し" },
  { group: "見出し", name: "title-2", fontSize: 24, lineHeight: 32, fontWeight: 600, letterSpacing: "-0.01em", sample: "初回お打ち合わせ", usage: "画面の見出し、予約ページの題名" },
  { group: "見出し", name: "title-3", fontSize: 20, lineHeight: 28, fontWeight: 600, letterSpacing: "-0.01em", sample: "おはようございます、佐藤さん", usage: "管理画面のホームの挨拶、ダイアログの題名" },
  { group: "見出し", name: "heading", fontSize: 15, lineHeight: 22, fontWeight: 600, sample: "今日の予定", usage: "パネルと章の見出し" },
  { group: "本文", name: "body-lg", fontSize: 15, lineHeight: 24, fontWeight: 400, sample: "サービスの概要をご説明し、いまの課題をお伺いします。", usage: "予約ページとアプリの本文" },
  { group: "本文", name: "body", fontSize: 14, lineHeight: 22, fontWeight: 400, sample: "チェックを付けた予定だけが、空き時間の計算に使われます。", usage: "管理画面の本文、一覧の行" },
  { group: "本文", name: "body-strong", fontSize: 14, lineHeight: 22, fontWeight: 500, sample: "高橋 健太さん", usage: "一覧の行の主な文字、ボタン" },
  { group: "本文", name: "small", fontSize: 13, lineHeight: 20, fontWeight: 400, sample: "山本 一郎さん・株式会社アルファ", usage: "補足、入力欄の説明" },
  { group: "本文", name: "caption", fontSize: 12, lineHeight: 18, fontWeight: 400, sample: "Google カレンダー「仕事」", usage: "バッジ、表の見出し、注記。これより小さくしない" },
  { group: "数字", name: "time", fontSize: 14, lineHeight: 20, fontWeight: 500, sample: "09:30 14:00–14:30", usage: "時刻。桁を揃える(tabular-nums)" },
  { group: "数字", name: "count", fontSize: 24, lineHeight: 30, fontWeight: 600, letterSpacing: "-0.01em", sample: "12 件", usage: "件数を大きく見せるところ" },
  { group: "数字", name: "code", family: "mono", fontSize: 13, lineHeight: 20, fontWeight: 400, sample: "slotto.jp/misaki/intro", usage: "URL、トークン、Webhook の送信内容" },
];

// 4px 刻み。名前は CSS では --space-<名前>
export const space = { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64, 20: 80, 24: 96 };

// 角丸
export const radius = { sm: 4, md: 6, lg: 10, xl: 14, full: 9999 };

// 罫線の太さ
export const borderWidth = { 1: 1, 2: 2 };

// 影。ダークは影が見えにくいので濃くする
export const shadow = {
  sm: { value: ["0 1px 2px rgba(16, 24, 40, 0.06)", "0 1px 2px rgba(0, 0, 0, 0.4)"], usage: "押せるカード、入力欄" },
  md: { value: ["0 1px 3px rgba(16, 24, 40, 0.06), 0 6px 16px rgba(16, 24, 40, 0.08)", "0 1px 3px rgba(0, 0, 0, 0.4), 0 6px 16px rgba(0, 0, 0, 0.35)"], usage: "メニュー、ツールチップ、トースト" },
  lg: { value: ["0 2px 6px rgba(16, 24, 40, 0.08), 0 16px 40px rgba(16, 24, 40, 0.16)", "0 2px 6px rgba(0, 0, 0, 0.5), 0 16px 40px rgba(0, 0, 0, 0.5)"], usage: "ダイアログ、横から出るパネル" },
};

// 動き。短く、ease-out。prefers-reduced-motion のときは止める
export const motion = {
  duration: { fast: 100, base: 160, slow: 240 },
  easing: { out: "cubic-bezier(0.2, 0.8, 0.2, 1)", inOut: "cubic-bezier(0.4, 0, 0.2, 1)" },
};

// 骨組みの寸法
export const layout = {
  sidebarWidth: 240,
  sidebarCollapsed: 64,
  headerHeight: 56,
  panelWidth: 400,
  contentMaxWidth: 1200,
  tabBarHeight: 56,
};

// コントラストの確認(build.mjs が両方のテーマで確かめる)。[前景, 背景, 必要な比]
export const contrastChecks = [
  ...["bg", "surface", "surface-raised", "surface-hover"].flatMap((b) => [
    ["text", b, 4.5],
    ["text-muted", b, 4.5],
  ]),
  ...["bg", "surface", "surface-raised"].map((b) => ["text-subtle", b, 4.5]),
  ["primary-text", "primary", 4.5],
  ["primary-text", "primary-hover", 4.5],
  ["primary-text", "primary-pressed", 4.5],
  ["primary-ink", "bg", 4.5],
  ["primary-ink", "surface", 4.5],
  ["primary-ink", "primary-soft", 4.5],
  ["text-muted", "primary-soft", 4.5],
  ["text", "primary-soft", 4.5],
  ["text-inverse", "text", 4.5],
  ["sidebar-text", "sidebar", 4.5],
  ["sidebar-text", "sidebar-hover", 4.5],
  ["sidebar-text", "sidebar-active", 4.5],
  ["sidebar-text-active", "sidebar-active", 4.5],
  ["sidebar-text-muted", "sidebar", 4.5],
  ["sidebar-accent", "sidebar", 4.5],
  ["sidebar-accent", "sidebar-active", 4.5],
  ["sidebar", "sidebar-accent", 4.5],
  ["border-control", "bg", 3],
  ["border-control", "surface", 3],
  ["focus-ring", "bg", 3],
  ["focus-ring", "surface", 3],
  ["primary", "bg", 3],
  ...["success", "warning", "danger", "info"].flatMap((s) => [
    [s, "bg", 4.5],
    [s, "surface", 4.5],
    [s, `${s}-soft`, 4.5],
  ]),
  ["danger-text", "danger", 4.5],
  ["danger-text", "danger-hover", 4.5],
  ...Object.keys(pageHues).flatMap((p) => [
    [`page-${p}`, "bg", 3],
    ["text", `page-${p}-soft`, 4.5],
    ["text-muted", `page-${p}-soft`, 4.5],
  ]),
];
