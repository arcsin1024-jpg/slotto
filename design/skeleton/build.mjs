// 管理画面の骨組みのモックを生成する(S3 と S5 が共通で使う)。
//   node design/skeleton/build.mjs <出力先フォルダ> <Design System の URL>
// 出力先の project/ に Design キャンバス用の canvas.json と .dc.html を書く。
// 画面: 予約一覧 + 右の詳細パネル。ライト(1440 幅)、ダーク(1440 幅)、狭い幅(1024 幅、サイドバーを畳む)。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { icon } from "../lib/icons.mjs";
import { themeColors } from "../tokens/resolve.mjs";
import { font, layout, radius } from "../tokens/source.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const [outDir, dsUrl] = process.argv.slice(2);
if (!outDir || !dsUrl) throw new Error("出力先フォルダと Design System の URL を指定してください");
const projectDir = join(outDir, "project");
mkdirSync(projectDir, { recursive: true });

const num = "font-variant-numeric: tabular-nums";
const r = radius;

function logo(file, height) {
  return readFileSync(join(here, "../logo", file), "utf8")
    .replace(/width="\d+" height="\d+"/, `height="${height}" style="display: block; flex-shrink: 0"`)
    .replace('role="img"', 'role="img" focusable="false"')
    .trim();
}

function page({ title, w, h, theme, body }) {
  const c = themeColors(theme);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="${font.url.replaceAll("&", "&amp;")}">
<style>
body{margin:0}
a{color:${c["color-primary-ink"]}}a:hover{color:${c["color-primary-hover"]}}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${w},"height":${h}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
}

const bookings = [
  { day: "10月5日(月)", items: [
    { s: "10:00", e: "10:30", title: "初回お打ち合わせ", who: "青木 亮さん", org: "青木デザイン事務所", tone: "blue", status: "確定", place: "Meet" },
    { s: "15:00", e: "16:00", title: "製品デモ", who: "加藤 陽子さん", org: "北斗物流株式会社", tone: "orange", status: "確定", place: "対面" },
  ] },
  { day: "10月6日(火)", items: [
    { s: "15:00", e: "16:00", title: "導入相談", who: "中村 由紀さん", org: "合同会社ひかり", tone: "purple", status: "承認待ち", place: "Meet", unread: true },
  ] },
  { day: "10月7日(水)", items: [
    { s: "14:30", e: "15:00", title: "初回お打ち合わせ", who: "伊藤 誠さん", org: "株式会社ミライ", tone: "blue", status: "確定", place: "Meet", selected: true },
    { s: "16:00", e: "16:30", title: "採用面談", who: "渡辺 さくらさん", org: "", tone: "green", status: "確定", place: "Meet" },
  ] },
  { day: "10月8日(木)", items: [
    { s: "10:30", e: "11:00", title: "初回お打ち合わせ", who: "小林 大輔さん", org: "", tone: "blue", status: "承認待ち", place: "Meet", unread: true },
  ] },
];

function shell({ theme, collapsed, width, height }) {
  const c = themeColors(theme);
  const sbW = collapsed ? layout.sidebarCollapsed : layout.sidebarWidth;

  const badge = (status) => {
    const map = { 確定: ["success", "success-soft"], 承認待ち: ["warning", "warning-soft"] };
    const [fg, bg] = map[status];
    return `<span style="display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 8px; border-radius: ${r.sm}px; background: ${c[`color-${bg}`]}; color: ${c[`color-${fg}`]}; font-size: 12px; font-weight: 500; white-space: nowrap"><span aria-hidden="true" style="width: 6px; height: 6px; border-radius: 9999px; background: ${c[`color-${fg}`]}"></span>${status}</span>`;
  };
  const count = (n, dark) =>
    `<span style="min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 9999px; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; ${num}; ${dark ? `background: ${c["color-sidebar-accent"]}; color: ${c["color-sidebar"]}` : `background: ${c["color-primary-soft"]}; color: ${c["color-primary-ink"]}`}">${n}</span>`;

  // サイドバー
  const nav = [
    ["home", "ホーム"],
    ["pages", "予約ページ"],
    ["bookings", "予約", true, "2"],
    ["calendar", "カレンダー"],
    ["import", "取り込み", false, "4"],
    ["plug", "連携"],
    ["settings", "設定"],
  ];
  const navHtml = nav
    .map(([ic, label, active, n]) => {
      const fg = active ? c["color-sidebar-text-active"] : c["color-sidebar-text"];
      const bg = active ? `background: ${c["color-sidebar-active"]};` : "";
      if (collapsed)
        return `<a href="#" aria-label="${label}${n ? `(${n}件)` : ""}"${active ? ' aria-current="page"' : ""} style="position: relative; width: 40px; height: 40px; margin: 0 auto; border-radius: ${r.md}px; display: flex; align-items: center; justify-content: center; ${bg}">${icon(ic, 20, active ? fg : c["color-sidebar-text-muted"])}${n ? `<span aria-hidden="true" style="position: absolute; top: 6px; right: 6px; width: 8px; height: 8px; border-radius: 9999px; background: ${c["color-sidebar-accent"]}; box-shadow: 0 0 0 2px ${active ? c["color-sidebar-active"] : c["color-sidebar"]}"></span>` : ""}</a>`;
      return `<a href="#"${active ? ' aria-current="page"' : ""} style="display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: ${r.md}px; text-decoration: none; font-size: 14px; color: ${fg}; ${bg} ${active ? "font-weight: 500;" : ""}">${icon(ic, 18, active ? fg : c["color-sidebar-text-muted"])}<span style="flex-grow: 1">${label}</span>${n ? count(n, true) : ""}</a>`;
    })
    .join("\n");

  const pages = [
    ["初回お打ち合わせ", "blue"],
    ["採用面談", "green"],
    ["導入相談", "purple"],
    ["製品デモ", "orange"],
  ];
  const sidebar = `<nav aria-label="メインメニュー" style="width: ${sbW}px; flex-shrink: 0; display: flex; flex-direction: column; gap: 20px; padding: 14px ${collapsed ? 12 : 12}px; box-sizing: border-box; background: ${c["color-sidebar"]}; border-right: 1px solid ${c["color-sidebar-border"]}">
<div style="display: flex; align-items: center; justify-content: ${collapsed ? "center" : "space-between"}; height: 32px; padding: 0 ${collapsed ? 0 : 8}px">
${collapsed ? logo("slotto-symbol-on-dark.svg", 28) : logo("slotto-wordmark-on-dark.svg", 22)}
${collapsed ? "" : `<button type="button" aria-label="サイドバーを畳む" style="width: 28px; height: 28px; border: 0; border-radius: ${r.md}px; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer">${icon("panel", 18, c["color-sidebar-text-muted"])}</button>`}
</div>
${collapsed
  ? `<button type="button" aria-label="予約ページを作る" style="width: 40px; height: 40px; margin: 0 auto; border: 1px solid ${c["color-sidebar-border"]}; border-radius: ${r.md}px; background: ${c["color-sidebar-active"]}; display: flex; align-items: center; justify-content: center; cursor: pointer">${icon("plus", 18, c["color-sidebar-text-active"])}</button>`
  : `<button type="button" style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 36px; border: 1px solid ${c["color-sidebar-border"]}; border-radius: ${r.md}px; background: ${c["color-sidebar-active"]}; color: ${c["color-sidebar-text-active"]}; font: inherit; font-size: 13px; font-weight: 500; cursor: pointer">${icon("plus", 16, c["color-sidebar-text-active"])}<span>予約ページを作る</span></button>`}
<div style="display: flex; flex-direction: column; gap: ${collapsed ? 4 : 2}px">
${navHtml}
</div>
${collapsed ? "" : `<div style="display: flex; flex-direction: column; gap: 2px">
<div style="padding: 0 10px 6px; font-size: 12px; font-weight: 500; color: ${c["color-sidebar-text-muted"]}">公開中の予約ページ</div>
${pages.map(([label, tone]) => `<a href="#" style="display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 10px; border-radius: ${r.md}px; text-decoration: none; font-size: 13px; color: ${c["color-sidebar-text"]}"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 9999px; background: ${themeColors("dark")[`page-${tone}`]}"></span><span>${label}</span></a>`).join("\n")}
</div>`}
<div style="margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 10px ${collapsed ? 0 : 8}px 0; justify-content: ${collapsed ? "center" : "flex-start"}; border-top: 1px solid ${c["color-sidebar-border"]}">
<span aria-hidden="true" style="width: 30px; height: 30px; border-radius: 9999px; background: ${c["page-blue-soft"]}; color: ${c["color-text"]}; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 600; flex-shrink: 0">佐</span>
${collapsed ? "" : `<div style="display: flex; flex-direction: column; min-width: 0"><span style="font-size: 13px; font-weight: 500; color: ${c["color-sidebar-text-active"]}">佐藤 美咲</span><span style="font-size: 12px; color: ${c["color-sidebar-text-muted"]}">slotto.jp/misaki</span></div>`}
</div>
</nav>`;

  // ヘッダー
  const header = `<header style="height: ${layout.headerHeight}px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 0 24px; background: ${c["color-bg"]}; border-bottom: 1px solid ${c["color-border"]}">
<h1 style="margin: 0; font-size: 15px; font-weight: 600; color: ${c["color-text"]}">予約</h1>
<label style="margin-left: auto; display: flex; align-items: center; gap: 8px; width: ${collapsed ? 240 : 320}px; height: 34px; padding: 0 10px; box-sizing: border-box; border: 1px solid ${c["color-border"]}; border-radius: ${r.md}px; background: ${c["color-surface"]}; color: ${c["color-text-muted"]}; font-size: 13px">
${icon("search", 16, c["color-text-muted"])}
<input type="search" placeholder="相手の名前やメールで検索" aria-label="検索" style="flex-grow: 1; min-width: 0; border: 0; background: transparent; font: inherit; color: ${c["color-text"]}; outline: none">
<span style="height: 20px; padding: 0 5px; display: inline-flex; align-items: center; border: 1px solid ${c["color-border-strong"]}; border-radius: ${r.sm}px; font-family: ${font.mono}; font-size: 11px; color: ${c["color-text-muted"]}">Ctrl K</span>
</label>
<button type="button" aria-label="お知らせ" style="width: 34px; height: 34px; border: 0; border-radius: ${r.md}px; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer">${icon("bell", 18, c["color-text-muted"])}</button>
</header>`;

  // タブと絞り込み
  const tabs = [
    ["これから", "12", true],
    ["承認待ち", "2"],
    ["過去"],
    ["キャンセル"],
  ];
  const tabsHtml = `<div role="tablist" style="display: flex; gap: 4px; padding: 0 24px; border-bottom: 1px solid ${c["color-border"]}; background: ${c["color-bg"]}">
${tabs.map(([label, n, active]) => `<button type="button" role="tab" aria-selected="${active ? "true" : "false"}" style="position: relative; height: 42px; padding: 0 10px; border: 0; background: transparent; font: inherit; font-size: 14px; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; color: ${active ? c["color-text"] : c["color-text-muted"]}; ${active ? "font-weight: 500;" : ""}">${label}${n ? count(n) : ""}${active ? `<span aria-hidden="true" style="position: absolute; left: 8px; right: 8px; bottom: -1px; height: 2px; border-radius: 2px 2px 0 0; background: ${c["color-primary"]}"></span>` : ""}</button>`).join("\n")}
</div>`;

  const filterBtn = (label) =>
    `<button type="button" style="display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border: 1px solid ${c["color-border-strong"]}; border-radius: ${r.md}px; background: ${c["color-bg"]}; font: inherit; font-size: 13px; color: ${c["color-text"]}; cursor: pointer">${label}${icon("chevD", 14, c["color-text-muted"])}</button>`;
  const filters = `<div style="display: flex; align-items: center; gap: 8px; padding: 14px 24px 10px">
${filterBtn(`<span style="color: ${c["color-text-muted"]}">予約ページ:</span>すべて`)}
${filterBtn(`<span style="color: ${c["color-text-muted"]}">期間:</span>今週と来週`)}
<span style="margin-left: auto; font-size: 13px; color: ${c["color-text-muted"]}; ${num}">12件</span>
</div>`;

  // 一覧(日付ごと)
  const row = (b) => {
    const bg = b.selected ? `background: ${c["color-primary-soft"]};` : "";
    return `<a href="#"${b.selected ? ' aria-current="true"' : ""} style="position: relative; display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 8px 16px 8px 20px; border-top: 1px solid ${c["color-border"]}; text-decoration: none; color: ${c["color-text"]}; ${bg}">
${b.unread ? `<span aria-label="新着" style="position: absolute; left: 7px; top: 50%; width: 6px; height: 6px; margin-top: -3px; border-radius: 9999px; background: ${c["color-primary"]}"></span>` : ""}
<div style="width: 44px; display: flex; flex-direction: column; font-size: 13px; line-height: 18px; ${num}; flex-shrink: 0"><span style="font-weight: 500">${b.s}</span><span style="color: ${b.selected ? c["color-text-muted"] : c["color-text-subtle"]}">${b.e}</span></div>
<span aria-hidden="true" style="width: 4px; align-self: stretch; border-radius: 9999px; background: ${c[`page-${b.tone}`]}; flex-shrink: 0"></span>
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px"><span style="font-size: 14px; font-weight: 500">${b.who}${b.org ? `<span style="font-weight: 400; color: ${c["color-text-muted"]}">・${b.org}</span>` : ""}</span><span style="font-size: 13px; color: ${c["color-text-muted"]}">${b.title}</span></div>
<span style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: ${c["color-text-muted"]}; width: 64px">${icon(b.place === "Meet" ? "video" : "pin", 14, c["color-text-muted"])}${b.place}</span>
<span style="width: 92px; display: flex; justify-content: flex-end">${badge(b.status)}</span>
</a>`;
  };
  const list = `<div style="flex: 1; min-height: 0; overflow: hidden; padding: 0 24px 24px">
<div style="background: ${c["color-bg"]}; border: 1px solid ${c["color-border"]}; border-radius: ${r.lg}px; overflow: hidden">
${bookings
  .map(
    (g, i) => `<div style="padding: 8px 16px; ${i ? `border-top: 1px solid ${c["color-border"]};` : ""} background: ${c["color-surface"]}; font-size: 12px; font-weight: 500; color: ${c["color-text-muted"]}; ${num}">${g.day}</div>
${g.items.map(row).join("\n")}`,
  )
  .join("\n")}
</div>
</div>`;

  // 詳細パネル
  const dl = [
    ["日時", `<span style="${num}">10月7日(水) 14:30–15:00</span><span style="display: block; font-size: 12px; color: ${c["color-text-muted"]}">日本時間・30分</span>`],
    ["予約ページ", `<span style="display: inline-flex; align-items: center; gap: 6px"><span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 9999px; background: ${c["page-blue"]}"></span>初回お打ち合わせ</span>`],
    ["場所", `<a href="#" style="display: inline-flex; align-items: center; gap: 6px; text-decoration: none; color: ${c["color-primary-ink"]}">${icon("video", 15, c["color-primary-ink"])}Google Meet に参加</a>`],
    ["メール", `<span style="font-family: ${font.mono}; font-size: 13px">makoto.ito@example.com</span>`],
    ["ご相談の内容", "来期から営業部 20 名で使える日程調整の方法を探しています。いまはメールで候補日を出し合っています。"],
  ];
  const history = [
    ["10月2日(金) 13:12", "予約を受け付けました"],
    ["10月2日(金) 13:12", "確認のメールを送りました"],
    ["10月2日(金) 13:13", "Google カレンダー「仕事」に書き込みました"],
  ];
  const panel = `<aside aria-label="予約の詳細" style="width: ${layout.panelWidth}px; flex-shrink: 0; display: flex; flex-direction: column; background: ${c["color-surface-raised"]}; border-left: 1px solid ${c["color-border"]}">
<div style="height: ${layout.headerHeight}px; flex-shrink: 0; display: flex; align-items: center; gap: 8px; padding: 0 12px 0 20px; border-bottom: 1px solid ${c["color-border"]}">
${badge("確定")}
<span style="flex: 1; font-size: 15px; font-weight: 600; color: ${c["color-text"]}">初回お打ち合わせ</span>
<button type="button" aria-label="その他の操作" style="width: 30px; height: 30px; border: 0; border-radius: ${r.md}px; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer">${icon("more", 18, c["color-text-muted"])}</button>
<button type="button" aria-label="閉じる" style="width: 30px; height: 30px; border: 0; border-radius: ${r.md}px; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer">${icon("x", 18, c["color-text-muted"])}</button>
</div>
<div style="flex: 1; min-height: 0; overflow: hidden; padding: 20px; display: flex; flex-direction: column; gap: 22px; color: ${c["color-text"]}">
<div style="display: flex; align-items: center; gap: 12px">
<span aria-hidden="true" style="width: 40px; height: 40px; border-radius: 9999px; background: ${c["page-teal-soft"]}; color: ${c["color-text"]}; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600">伊</span>
<div style="display: flex; flex-direction: column"><span style="font-size: 15px; font-weight: 600">伊藤 誠さん</span><span style="font-size: 13px; color: ${c["color-text-muted"]}">株式会社ミライ</span></div>
</div>
<dl style="margin: 0; display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 12px 12px; font-size: 14px; line-height: 22px">
${dl.map(([k, v]) => `<dt style="color: ${c["color-text-muted"]}">${k}</dt><dd style="margin: 0; min-width: 0">${v}</dd>`).join("\n")}
</dl>
<section style="display: flex; flex-direction: column; gap: 10px">
<h2 style="margin: 0; font-size: 13px; font-weight: 600; color: ${c["color-text"]}">履歴</h2>
<ol style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px">
${history.map(([t, s]) => `<li style="display: flex; gap: 10px; font-size: 13px; line-height: 20px"><span aria-hidden="true" style="width: 7px; height: 7px; margin-top: 7px; border-radius: 9999px; border: 1.5px solid ${c["color-border-control"]}; flex-shrink: 0; box-sizing: border-box"></span><span style="color: ${c["color-text"]}">${s}<span style="display: block; font-size: 12px; color: ${c["color-text-muted"]}; ${num}">${t}</span></span></li>`).join("\n")}
</ol>
</section>
</div>
<div style="flex-shrink: 0; display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid ${c["color-border"]}">
<button type="button" style="height: 34px; padding: 0 14px; border: 1px solid ${c["color-border-strong"]}; border-radius: ${r.md}px; background: ${c["color-bg"]}; color: ${c["color-text"]}; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer">日程の変更を依頼</button>
<button type="button" style="margin-left: auto; height: 34px; padding: 0 14px; border: 0; border-radius: ${r.md}px; background: transparent; color: ${c["color-danger"]}; font: inherit; font-size: 14px; font-weight: 500; cursor: pointer">予約をキャンセル</button>
</div>
</aside>`;

  return `<div style="width: ${width}px; height: ${height}px; display: flex; overflow: hidden; font-family: ${font.sans}; font-size: 14px; line-height: 1.5; color: ${c["color-text"]}; background: ${c["color-surface"]}">
${sidebar}
<div style="flex: 1; min-width: 0; display: flex; flex-direction: column">
${header}
<div style="flex: 1; min-height: 0; display: flex">
<main style="flex: 1; min-width: 0; display: flex; flex-direction: column">
${tabsHtml}
${filters}
${list}
</main>
${panel}
</div>
</div>
</div>`;
}

const boards = {
  "Main.dc.html": { title: "予約一覧 + 詳細パネル(ライト)", theme: "light", collapsed: false, w: 1440, h: 900, x: 0, y: 0 },
  "Dark.dc.html": { title: "予約一覧 + 詳細パネル(ダーク)", theme: "dark", collapsed: false, w: 1440, h: 900, x: 1520, y: 0 },
  "Narrow.dc.html": { title: "狭い幅(1024px、サイドバーを畳む)", theme: "light", collapsed: true, w: 1024, h: 768, x: 0, y: 1020 },
};

for (const [file, b] of Object.entries(boards)) {
  writeFileSync(
    join(projectDir, file),
    page({ title: b.title, w: b.w, h: b.h, theme: b.theme, body: shell({ theme: b.theme, collapsed: b.collapsed, width: b.w, height: b.h }) }),
  );
}

const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: now },
  title: "Slotto 管理画面の骨組み",
  launch: { view: "canvas" },
  pages: [],
  boards: Object.fromEntries(Object.entries(boards).map(([f, b]) => [f, { x: b.x, y: b.y, w: b.w, h: b.h, title: b.title }])),
  order: Object.keys(boards),
  notes: {
    memo: {
      x: 1104,
      y: 1020,
      w: 520,
      text: "骨組みの寸法(packages/tokens の layout)\n・サイドバー 240px、畳むと 64px(幅 1280px 未満で畳む)\n・ヘッダー 56px\n・詳細パネル 400px。一覧の行を押すと開く\n・幅 1024px 未満では、詳細パネルを画面いっぱいに重ねる\n・下地は color-surface、パネルとカードは color-bg",
      fill: "blue",
    },
  },
  designSystems: [{ title: "Slotto Design System", namespace: "slotto", artifact: dsUrl, version: null, copiedAt: now }],
};
writeFileSync(join(projectDir, "canvas.json"), JSON.stringify(canvas, null, 2));
console.log("wrote", Object.keys(boards).length, "artboards to", projectDir);
