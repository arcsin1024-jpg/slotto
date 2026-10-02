// 方向の案のモックを生成する。themes.mjs の 3 案を、代表画面 3 つに当てる。
// 使い方: node design/directions/build.mjs <出力先フォルダ>
// 出力先の project/ に Design キャンバス用の canvas.json と .dc.html を書き出す。

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { oklch } from "../lib/color.mjs";
import { themes } from "./themes.mjs";

const outDir = process.argv[2];
if (!outDir) throw new Error("出力先フォルダを指定してください");
const projectDir = join(outDir, "project");
mkdirSync(projectDir, { recursive: true });

// ---------- 部品 ----------

const ICONS = {
  home: '<path d="M3.5 10.5 12 3.5l8.5 7V20a.5.5 0 0 1-.5.5h-5v-6h-6v6H4a.5.5 0 0 1-.5-.5z"/>',
  pages:
    '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  bookings:
    '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4M9 14.5l2 2 4-4"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>',
  import: '<path d="M12 3.5v10.5M8 10l4 4 4-4"/><path d="M4 14.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5"/>',
  plug: '<path d="M9 3.5V8M15 3.5V8"/><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 16.5v4"/>',
  settings:
    '<path d="M4 6h8M16 6h4M4 12h2M10 12h10M4 18h10M18 18h2"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="16" cy="18" r="2"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  video: '<rect x="3" y="6.5" width="12.5" height="11" rx="2"/><path d="M15.5 10.5 21 8v8l-5.5-2.5"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chevL: '<path d="M14.5 6l-6 6 6 6"/>',
  chevR: '<path d="M9.5 6l6 6-6 6"/>',
  chevD: '<path d="M6 9.5l6 6 6-6"/>',
  globe:
    '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.6 2.6 14.4 0 17M12 3.5c-2.6 2.6-2.6 14.4 0 17"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  zap: '<path d="M13 3 5.5 13.5h6L10.5 21 18 10.5h-6z"/>',
  pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  users:
    '<circle cx="9" cy="8.5" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2 .7 3.5 2.6 3.5 5.2"/>',
};

function icon(name, size, color, sw = 1.75) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink: 0">${ICONS[name]}</svg>`;
}

// 仮のロゴ記号(手順 2 で作り直す): 角丸の枠に、長さの違う 2 本の予約枠
function mark(size, bg, fg) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="flex-shrink: 0"><rect width="24" height="24" rx="6" fill="${bg}"/><rect x="6" y="7.5" width="12" height="3.5" rx="1.75" fill="${fg}"/><rect x="6" y="13" width="7.5" height="3.5" rx="1.75" fill="${fg}"/></svg>`;
}

function avatar(ch, hue, size = 32) {
  const bg = oklch(0.92, 0.04, hue);
  const fg = oklch(0.4, 0.1, hue);
  return `<span aria-hidden="true" style="width: ${size}px; height: ${size}px; border-radius: 9999px; background: ${bg}; color: ${fg}; display: flex; align-items: center; justify-content: center; font-size: ${Math.round(size * 0.42)}px; font-weight: 600; flex-shrink: 0">${ch}</span>`;
}

// 予約ページの色(サイドバーの一覧と予定の点に使う)
const PAGE = {
  blue: oklch(0.55, 0.15, 250),
  green: oklch(0.55, 0.12, 160),
  orange: oklch(0.6, 0.15, 55),
  gray: oklch(0.6, 0.02, 260),
};
const PAGE_ON_DARK = {
  blue: oklch(0.72, 0.12, 250),
  green: oklch(0.74, 0.11, 160),
  orange: oklch(0.76, 0.12, 60),
};

function resolve(key, t) {
  const c = {};
  for (const [k, v] of Object.entries(t.color)) c[k] = typeof v === "string" ? v : oklch(...v);
  return { key, ...t, c };
}

function page({ t, title, width, height, body }) {
  const fontHref = t.fontUrl.replaceAll("&", "&amp;");
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
<link rel="stylesheet" href="${fontHref}">
<style>
body{margin:0}
a{color:${t.c.primaryInk}}a:hover{color:${t.c.primaryHover}}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":${width},"height":${height}}}'>
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

const numStyle = (t) => `font-family: ${t.num}; font-variant-numeric: tabular-nums`;

// ---------- 画面 1: 管理画面のホーム ----------

function adminHome(t) {
  const { c, radius: r, weight: w } = t;
  const nav = [
    ["home", "ホーム", true],
    ["pages", "予約ページ"],
    ["bookings", "予約", false, "2"],
    ["calendar", "カレンダー"],
    ["import", "取り込み", false, "4"],
    ["plug", "連携"],
    ["settings", "設定"],
  ];
  const navHtml = nav
    .map(
      ([ic, label, active, badge]) => `<a href="#" style="display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 10px; border-radius: ${r.md}px; text-decoration: none; font-size: 14px; ${active ? `background: ${c.sidebarActive}; color: ${c.sidebarTextActive}; font-weight: ${w.medium}` : `color: ${c.sidebarText}`}"${active ? ' aria-current="page"' : ""}>
${icon(ic, 18, active ? c.sidebarTextActive : c.sidebarMuted)}
<span style="flex-grow: 1">${label}</span>
${badge ? `<span style="min-width: 20px; height: 20px; padding: 0 6px; box-sizing: border-box; border-radius: 9999px; background: ${c.primaryOnDark}; color: ${c.sidebar}; font-size: 12px; font-weight: ${w.semi}; display: flex; align-items: center; justify-content: center; ${numStyle(t)}">${badge}</span>` : ""}
</a>`,
    )
    .join("\n");

  const pages = [
    ["初回お打ち合わせ", PAGE_ON_DARK.blue],
    ["採用面談", PAGE_ON_DARK.green],
    ["製品デモ", PAGE_ON_DARK.orange],
  ]
    .map(
      ([label, dot]) => `<a href="#" style="display: flex; align-items: center; gap: 10px; height: 30px; padding: 0 10px; border-radius: ${r.md}px; text-decoration: none; font-size: 13px; color: ${c.sidebarText}">
<span aria-hidden="true" style="width: 8px; height: 8px; border-radius: 9999px; background: ${dot}; flex-shrink: 0"></span>
<span>${label}</span>
</a>`,
    )
    .join("\n");

  const sidebar = `<nav aria-label="メインメニュー" style="width: 236px; flex-shrink: 0; background: ${c.sidebar}; display: flex; flex-direction: column; padding: 16px 12px; box-sizing: border-box; gap: 20px">
<div style="display: flex; align-items: center; gap: 10px; padding: 4px 8px">
${mark(26, c.primaryOnDark, c.sidebar)}
<span style="font-size: 19px; font-weight: ${w.bold}; color: ${c.sidebarTextActive}; letter-spacing: -0.02em">slotto</span>
</div>
<button type="button" style="display: flex; align-items: center; justify-content: center; gap: 8px; height: 36px; border: 1px solid ${c.sidebarLine}; border-radius: ${r.md}px; background: ${c.sidebarActive}; color: ${c.sidebarTextActive}; font: inherit; font-size: 13px; font-weight: ${w.medium}; cursor: pointer">
${icon("plus", 16, c.sidebarTextActive)}
<span>予約ページを作る</span>
</button>
<div style="display: flex; flex-direction: column; gap: 2px">
${navHtml}
</div>
<div style="display: flex; flex-direction: column; gap: 2px">
<div style="padding: 0 10px 6px; font-size: 12px; color: ${c.sidebarMuted}; font-weight: ${w.medium}">公開中の予約ページ</div>
${pages}
</div>
<div style="margin-top: auto; display: flex; align-items: center; gap: 10px; padding: 10px 8px 0; border-top: 1px solid ${c.sidebarLine}">
${avatar("佐", 20, 30)}
<div style="display: flex; flex-direction: column; min-width: 0">
<span style="font-size: 13px; color: ${c.sidebarTextActive}; font-weight: ${w.medium}">佐藤 美咲</span>
<span style="font-size: 12px; color: ${c.sidebarMuted}">slotto.jp/misaki</span>
</div>
</div>
</nav>`;

  const events = [
    { s: "09:30", e: "10:00", title: "週次定例", sub: "Google カレンダー「仕事」", dot: PAGE.gray, past: true, tag: "反映中" },
    { s: "11:00", e: "11:30", title: "初回お打ち合わせ", sub: "山本 一郎さん・株式会社アルファ", dot: PAGE.blue, past: true, place: ["video", "Meet"] },
    { now: "13:35" },
    { s: "14:00", e: "14:30", title: "採用面談", sub: "高橋 健太さん", dot: PAGE.green, next: true, place: ["video", "Meet"] },
    { s: "16:00", e: "17:00", title: "製品デモ", sub: "鈴木 花子さん・みどり商事", dot: PAGE.orange, place: ["pin", "対面"] },
  ];
  const eventsHtml = events
    .map((ev) => {
      if (ev.now)
        return `<div style="display: flex; align-items: center; gap: 10px; padding: 2px 16px">
<span style="width: 44px; font-size: 12px; font-weight: ${w.semi}; color: ${c.primaryInk}; ${numStyle(t)}">${ev.now}</span>
<span aria-hidden="true" style="width: 7px; height: 7px; border-radius: 9999px; background: ${c.primary}"></span>
<span aria-hidden="true" style="flex-grow: 1; height: 1.5px; background: ${c.primary}"></span>
</div>`;
      const titleColor = ev.past ? c.muted : c.text;
      const right = ev.next
        ? `<span style="font-size: 12px; font-weight: ${w.semi}; color: ${c.primaryInk}; ${numStyle(t)}">あと 25分</span>
<button type="button" style="display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border: 0; border-radius: ${r.md}px; background: ${c.primary}; color: ${c.primaryText}; font: inherit; font-size: 13px; font-weight: ${w.medium}; cursor: pointer">${icon("video", 15, c.primaryText)}<span>参加する</span></button>`
        : ev.tag
          ? `<span style="font-size: 12px; color: ${c.muted}; border: 1px solid ${c.border}; border-radius: 9999px; padding: 2px 8px">${ev.tag}</span>`
          : `<span style="display: flex; align-items: center; gap: 4px; font-size: 12px; color: ${c.muted}">${icon(ev.place[0], 14, c.muted)}${ev.place[1]}</span>`;
      return `<div style="display: flex; align-items: center; gap: 12px; padding: 10px 16px; ${ev.next ? `background: ${c.primarySoft};` : ""}">
<div style="width: 44px; display: flex; flex-direction: column; font-size: 13px; line-height: 1.35; ${numStyle(t)}">
<span style="color: ${ev.past ? c.subtle : c.text}; font-weight: ${w.medium}">${ev.s}</span>
<span style="color: ${ev.next ? c.muted : c.subtle}">${ev.e}</span>
</div>
<span aria-hidden="true" style="width: 4px; align-self: stretch; border-radius: 9999px; background: ${ev.dot}; flex-shrink: 0"></span>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0">
<span style="font-size: 14px; font-weight: ${w.medium}; color: ${titleColor}">${ev.title}</span>
<span style="font-size: 12.5px; color: ${ev.next ? c.muted : ev.past ? c.subtle : c.muted}">${ev.sub}</span>
</div>
${right}
</div>`;
    })
    .join("\n");

  const panel = (title, count, inner, link) => `<section style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: ${r.lg}px; overflow: hidden">
<div style="display: flex; align-items: center; gap: 8px; padding: 14px 16px 10px">
<h2 style="margin: 0; font-size: 14px; font-weight: ${w.semi}; color: ${c.text}">${title}</h2>
${count ? `<span style="font-size: 12px; font-weight: ${w.semi}; color: ${c.primaryInk}; background: ${c.primarySoft}; border-radius: 9999px; padding: 1px 8px; ${numStyle(t)}">${count}</span>` : ""}
${link ? `<a href="#" style="margin-left: auto; font-size: 13px; text-decoration: none; color: ${c.primaryInk}">${link}</a>` : ""}
</div>
${inner}
</section>`;

  const approvals = [
    { ch: "中", hue: 320, name: "中村 由紀さん", org: "合同会社ひかり", what: "導入相談・60分", when: "10月6日(火) 15:00–16:00" },
    { ch: "小", hue: 200, name: "小林 大輔さん", org: "個人", what: "初回お打ち合わせ・30分", when: "10月8日(木) 10:30–11:00" },
  ]
    .map(
      (a) => `<div style="display: flex; gap: 12px; padding: 12px 16px; border-top: 1px solid ${c.border}">
${avatar(a.ch, a.hue, 32)}
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 3px; min-width: 0">
<div style="display: flex; align-items: baseline; gap: 8px"><span style="font-size: 14px; font-weight: ${w.medium}; color: ${c.text}">${a.name}</span><span style="font-size: 12px; color: ${c.muted}">${a.org}</span></div>
<span style="font-size: 13px; color: ${c.text}; ${numStyle(t)}">${a.when}</span>
<span style="font-size: 12.5px; color: ${c.muted}">${a.what}</span>
</div>
<div style="display: flex; flex-direction: column; gap: 6px">
<button type="button" style="height: 28px; padding: 0 14px; border: 0; border-radius: ${r.md}px; background: ${c.primary}; color: ${c.primaryText}; font: inherit; font-size: 13px; font-weight: ${w.medium}; cursor: pointer">承認</button>
<button type="button" style="height: 28px; padding: 0 14px; border: 1px solid ${c.borderStrong}; border-radius: ${r.md}px; background: ${c.bg}; color: ${c.text}; font: inherit; font-size: 13px; cursor: pointer">辞退</button>
</div>
</div>`,
    )
    .join("\n");

  const newcomers = [
    ["n1", "10/5(月)", "10:00–11:00", "部内レビュー", "仕事"],
    ["n2", "10/6(火)", "13:00–14:00", "歯医者", "個人"],
    ["n3", "10/7(水)", "18:00–20:00", "懇親会", "仕事"],
    ["n4", "10/9(金)", "09:00–09:30", "1on1(田中さん)", "仕事"],
  ]
    .map(
      ([id, d, tm, title, cal]) => `<div style="display: flex; align-items: center; gap: 10px; padding: 9px 16px; border-top: 1px solid ${c.border}">
<input type="checkbox" id="${id}" style="width: 16px; height: 16px; margin: 0; accent-color: ${c.primary}; flex-shrink: 0">
<label for="${id}" style="flex-grow: 1; display: flex; align-items: center; gap: 10px; font-size: 13px; color: ${c.text}; cursor: pointer">
<span style="width: 132px; color: ${c.muted}; ${numStyle(t)}">${d} ${tm}</span>
<span style="flex-grow: 1">${title}</span>
<span style="font-size: 12px; color: ${c.muted}">${cal}</span>
</label>
</div>`,
    )
    .join("\n");

  const main = `<div style="flex-grow: 1; display: flex; flex-direction: column; background: ${c.surface}; min-width: 0">
<header style="height: 56px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 0 28px; background: ${c.bg}; border-bottom: 1px solid ${c.border}">
<span style="font-size: 15px; font-weight: ${w.semi}; color: ${c.text}">ホーム</span>
<label style="margin-left: auto; display: flex; align-items: center; gap: 8px; width: 300px; height: 34px; padding: 0 10px; box-sizing: border-box; border: 1px solid ${c.border}; border-radius: ${r.md}px; background: ${c.surface}; color: ${c.muted}; font-size: 13px">
${icon("search", 16, c.muted)}
<input type="search" placeholder="予定や相手の名前で検索" aria-label="検索" style="flex-grow: 1; border: 0; background: transparent; font: inherit; color: ${c.text}; outline: none; min-width: 0">
<span style="font-size: 11px; color: ${c.muted}; border: 1px solid ${c.borderStrong}; border-radius: ${r.sm}px; padding: 0 5px; ${numStyle(t)}">Ctrl K</span>
</label>
<button type="button" style="display: flex; align-items: center; gap: 6px; height: 34px; padding: 0 14px; border: 1px solid ${c.borderStrong}; border-radius: ${r.md}px; background: ${c.bg}; color: ${c.text}; font: inherit; font-size: 13px; font-weight: ${w.medium}; cursor: pointer">${icon("pages", 16, c.text)}<span>リンクをコピー</span></button>
</header>
<div style="flex-grow: 1; padding: 24px 28px; display: flex; flex-direction: column; gap: 18px; overflow: hidden">
<div style="display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 13px; color: ${c.muted}; ${numStyle(t)}">10月2日(金)</span>
<h1 style="margin: 0; font-size: 22px; font-weight: ${w.semi}; color: ${c.text}; letter-spacing: -0.01em">おはようございます、佐藤さん</h1>
<p style="margin: 0; font-size: 13px; color: ${c.muted}">今日は予約が 3 件、反映中の予定が 1 件あります。</p>
</div>
<div style="display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 18px; align-items: start">
${panel("今日の予定", "", `<div style="display: flex; flex-direction: column; padding-bottom: 8px">${eventsHtml}</div>`, "カレンダーで見る")}
<div style="display: flex; flex-direction: column; gap: 18px">
${panel("承認待ち", "2", approvals, "")}
${panel("未選択の新着", "4", `<p style="margin: 0; padding: 0 16px 10px; font-size: 12.5px; color: ${c.muted}">チェックを付けた予定だけが、空き時間の計算に使われます。</p>${newcomers}`, "取り込みを開く")}
</div>
</div>
</div>
</div>`;

  return page({
    t,
    title: `${t.key} 管理画面のホーム`,
    width: 1280,
    height: 800,
    body: `<div style="width: 1280px; height: 800px; display: flex; overflow: hidden; font-family: ${t.sans}; color: ${c.text}; background: ${c.bg}; line-height: 1.5">
${sidebar}
${main}
</div>`,
  });
}

// ---------- 画面 2: ゲストの予約ページ ----------

function bookingPage(t) {
  const { c, radius: r, weight: w } = t;
  // 2026 年 10 月。1 日は木曜。5 日以降の平日が受付日。12 日は祝日、9 日と 21 日は満席
  const avail = new Set([5, 6, 7, 8, 13, 14, 15, 16, 19, 20, 22, 23, 26, 27, 28, 29, 30]);
  const selected = 7;
  const today = 2;
  const cells = [];
  for (let i = 0; i < 4; i++) cells.push(`<span aria-hidden="true"></span>`);
  for (let d = 1; d <= 31; d++) {
    const isSel = d === selected;
    const ok = avail.has(d);
    const base = `width: 40px; height: 40px; margin: 0 auto; border-radius: 9999px; font: inherit; font-size: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; ${numStyle(t)}`;
    if (isSel)
      cells.push(`<button type="button" aria-pressed="true" aria-label="10月${d}日" style="${base}; border: 0; background: ${c.primary}; color: ${c.primaryText}; font-weight: ${w.semi}; cursor: pointer">${d}</button>`);
    else if (ok)
      cells.push(`<button type="button" aria-label="10月${d}日" style="${base}; border: 0; background: ${c.primarySoft}; color: ${c.primaryInk}; font-weight: ${w.semi}; cursor: pointer">${d}</button>`);
    else
      cells.push(`<button type="button" disabled aria-label="10月${d}日(受付なし)" style="${base}; border: 0; background: transparent; color: ${c.subtle}">${d}${d === today ? `<span aria-hidden="true" style="position: absolute; bottom: 5px; width: 4px; height: 4px; border-radius: 9999px; background: ${c.subtle}"></span>` : ""}</button>`);
  }
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"]
    .map((d) => `<span style="text-align: center; font-size: 12px; color: ${c.muted}">${d}</span>`)
    .join("");

  const slots = ["10:00", "10:30", "11:00", "13:30", "14:00", "14:30", "15:00", "16:30"]
    .map((s) =>
      s === "14:30"
        ? `<button type="button" aria-pressed="true" style="height: 42px; border: 0; border-radius: ${r.md}px; background: ${c.primary}; color: ${c.primaryText}; font: inherit; font-size: 14px; font-weight: ${w.semi}; cursor: pointer; ${numStyle(t)}">${s}</button>`
        : `<button type="button" style="height: 42px; border: 1px solid ${c.borderStrong}; border-radius: ${r.md}px; background: ${c.bg}; color: ${c.primaryInk}; font: inherit; font-size: 14px; font-weight: ${w.semi}; cursor: pointer; ${numStyle(t)}">${s}</button>`,
    )
    .join("\n");

  const meta = (ic, text) =>
    `<div style="display: flex; align-items: flex-start; gap: 10px; font-size: 14px; color: ${c.text}">${icon(ic, 18, c.muted)}<span>${text}</span></div>`;

  return page({
    t,
    title: `${t.key} ゲストの予約ページ`,
    width: 1280,
    height: 800,
    body: `<div style="width: 1280px; height: 800px; box-sizing: border-box; padding: 56px 0 0; display: flex; flex-direction: column; align-items: center; gap: 20px; font-family: ${t.sans}; color: ${c.text}; background: ${c.surface}; line-height: 1.6">
<main style="width: 1010px; background: ${c.bg}; border: 1px solid ${c.border}; border-radius: ${r.lg}px; box-shadow: 0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.05); display: flex; flex-direction: column; overflow: hidden">
<div style="display: flex">
<div style="width: 320px; flex-shrink: 0; padding: 28px; box-sizing: border-box; border-right: 1px solid ${c.border}; display: flex; flex-direction: column; gap: 18px">
<div style="display: flex; align-items: center; gap: 12px">
${avatar("佐", 20, 44)}
<div style="display: flex; flex-direction: column">
<span style="font-size: 14px; font-weight: ${w.medium}">佐藤 美咲</span>
<span style="font-size: 13px; color: ${c.muted}">株式会社ノード</span>
</div>
</div>
<h1 style="margin: 0; font-size: 22px; font-weight: ${w.semi}; letter-spacing: -0.01em; line-height: 1.4">初回お打ち合わせ</h1>
<div style="display: flex; flex-direction: column; gap: 10px">
${meta("clock", "30分")}
${meta("video", "Google Meet<br><span style=\"font-size: 13px; color: " + c.muted + "\">予約が確定すると URL をお送りします</span>")}
</div>
<p style="margin: 0; font-size: 14px; color: ${c.muted}">サービスの概要をご説明し、いまの課題をお伺いします。事前の準備は必要ありません。</p>
</div>
<div style="flex-grow: 1; padding: 28px; box-sizing: border-box; display: flex; flex-direction: column; gap: 14px">
<h2 style="margin: 0; font-size: 16px; font-weight: ${w.semi}">日時を選んでください</h2>
<div style="display: flex; align-items: center; justify-content: space-between">
<span style="font-size: 15px; font-weight: ${w.medium}; ${numStyle(t)}">2026年10月</span>
<div style="display: flex; gap: 4px">
<button type="button" aria-label="前の月" style="width: 32px; height: 32px; border: 0; border-radius: 9999px; background: transparent; display: flex; align-items: center; justify-content: center; cursor: pointer">${icon("chevL", 18, c.subtle)}</button>
<button type="button" aria-label="次の月" style="width: 32px; height: 32px; border: 0; border-radius: 9999px; background: ${c.primarySoft}; display: flex; align-items: center; justify-content: center; cursor: pointer">${icon("chevR", 18, c.primaryInk)}</button>
</div>
</div>
<div style="display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: 6px">
${weekdays}
${cells.join("\n")}
</div>
<button type="button" style="align-self: flex-start; display: flex; align-items: center; gap: 6px; border: 0; background: transparent; padding: 4px 0; font: inherit; font-size: 13px; color: ${c.text}; cursor: pointer">${icon("globe", 16, c.muted)}<span>日本時間(GMT+09:00)</span>${icon("chevD", 14, c.muted)}</button>
</div>
<div style="width: 220px; flex-shrink: 0; padding: 28px 24px 28px 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 10px">
<span style="font-size: 14px; font-weight: ${w.medium}; ${numStyle(t)}; padding-bottom: 4px">10月7日(水)</span>
${slots}
</div>
</div>
<div style="display: flex; align-items: center; gap: 16px; padding: 14px 28px; border-top: 1px solid ${c.border}; background: ${c.surface}">
<span style="font-size: 14px; color: ${c.text}"><span style="color: ${c.muted}">選択中:</span> <span style="font-weight: ${w.medium}; ${numStyle(t)}">10月7日(水) 14:30–15:00</span></span>
<button type="button" style="margin-left: auto; height: 40px; padding: 0 24px; border: 0; border-radius: ${r.md}px; background: ${c.primary}; color: ${c.primaryText}; font: inherit; font-size: 14px; font-weight: ${w.semi}; cursor: pointer">次へ</button>
</div>
</main>
<a href="#" style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: ${c.muted}; text-decoration: none">${mark(14, c.muted, c.surface)}<span>slotto で日程調整</span></a>
</div>`,
  });
}

// ---------- 画面 3: アプリのホーム ----------

function appHome(t) {
  const { c, radius: r, weight: w } = t;
  const rows = [
    { s: "09:30", e: "10:00", title: "週次定例", sub: "反映中・Google カレンダー", dot: PAGE.gray, past: true },
    { s: "11:00", e: "11:30", title: "初回お打ち合わせ", sub: "山本 一郎さん", dot: PAGE.blue, past: true },
    { s: "14:00", e: "14:30", title: "採用面談", sub: "高橋 健太さん", dot: PAGE.green },
    { s: "16:00", e: "17:00", title: "製品デモ", sub: "鈴木 花子さん・対面", dot: PAGE.orange },
  ]
    .map(
      (ev, i) => `<div style="display: flex; align-items: center; gap: 12px; padding: 12px 16px; min-height: 44px; ${i ? `border-top: 1px solid ${c.border};` : ""}">
<div style="width: 42px; display: flex; flex-direction: column; font-size: 13px; line-height: 1.35; ${numStyle(t)}">
<span style="color: ${ev.past ? c.subtle : c.text}; font-weight: ${w.medium}">${ev.s}</span>
<span style="color: ${c.subtle}">${ev.e}</span>
</div>
<span aria-hidden="true" style="width: 4px; align-self: stretch; border-radius: 9999px; background: ${ev.dot}"></span>
<div style="flex-grow: 1; display: flex; flex-direction: column; gap: 1px">
<span style="font-size: 15px; font-weight: ${w.medium}; color: ${ev.past ? c.muted : c.text}">${ev.title}</span>
<span style="font-size: 13px; color: ${ev.past ? c.subtle : c.muted}">${ev.sub}</span>
</div>
${icon("chevR", 16, c.subtle)}
</div>`,
    )
    .join("\n");

  const tile = (n, label, sub) => `<a href="#" style="display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border: 1px solid ${c.border}; border-radius: ${r.lg}px; background: ${c.bg}; text-decoration: none; color: ${c.text}">
<span style="font-size: 24px; font-weight: ${w.semi}; line-height: 1.2; ${numStyle(t)}">${n}<span style="font-size: 14px; font-weight: ${w.medium}; margin-left: 2px">件</span></span>
<span style="font-size: 14px; font-weight: ${w.medium}">${label}</span>
<span style="font-size: 12px; color: ${c.muted}">${sub}</span>
</a>`;

  const tabs = [
    ["home", "ホーム", true],
    ["calendar", "カレンダー"],
    ["pages", "予約ページ"],
    ["zap", "オートメーション"],
    ["settings", "設定"],
  ]
    .map(
      ([ic, label, active]) => `<a href="#" style="flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 3px; padding-top: 8px; min-height: 44px; text-decoration: none; color: ${active ? c.primaryInk : c.muted}; font-size: 10px; letter-spacing: -0.03em; font-weight: ${active ? w.semi : 400}; white-space: nowrap"${active ? ' aria-current="page"' : ""}>${icon(ic, 24, active ? c.primaryInk : c.muted, active ? 2 : 1.75)}<span>${label}</span></a>`,
    )
    .join("\n");

  return page({
    t,
    title: `${t.key} アプリのホーム`,
    width: 390,
    height: 844,
    body: `<div style="width: 390px; height: 844px; display: flex; flex-direction: column; overflow: hidden; font-family: ${t.sans}; color: ${c.text}; background: ${c.surface}; line-height: 1.5">
<div style="flex-grow: 1; padding: 60px 16px 16px; display: flex; flex-direction: column; gap: 16px; overflow: hidden">
<header style="display: flex; align-items: flex-end; gap: 8px">
<div style="display: flex; flex-direction: column">
<span style="font-size: 13px; color: ${c.muted}; ${numStyle(t)}">10月2日(金)</span>
<h1 style="margin: 0; font-size: 28px; font-weight: ${w.bold}; letter-spacing: -0.02em; line-height: 1.25">今日</h1>
</div>
<button type="button" aria-label="通知" style="margin-left: auto; width: 44px; height: 44px; border: 0; border-radius: 9999px; background: transparent; display: flex; align-items: center; justify-content: center">${icon("bell", 22, c.text)}</button>
${avatar("佐", 20, 34)}
</header>
<section aria-label="次の予定" style="background: ${c.sidebar}; border-radius: ${r.lg + 4}px; padding: 18px; display: flex; flex-direction: column; gap: 12px; color: ${c.sidebarTextActive}">
<div style="display: flex; align-items: center; gap: 8px">
<span style="font-size: 13px; color: ${c.sidebarText}">次の予定</span>
<span style="margin-left: auto; font-size: 13px; font-weight: ${w.semi}; color: ${c.primaryOnDark}; ${numStyle(t)}">あと 25分</span>
</div>
<div style="display: flex; flex-direction: column; gap: 2px">
<span style="font-size: 22px; font-weight: ${w.semi}; letter-spacing: -0.01em; line-height: 1.35">採用面談</span>
<span style="font-size: 14px; color: ${c.sidebarText}">高橋 健太さん</span>
</div>
<div style="display: flex; align-items: center; gap: 14px; font-size: 14px; color: ${c.sidebarText}">
<span style="display: flex; align-items: center; gap: 6px; ${numStyle(t)}">${icon("clock", 16, c.sidebarMuted)}14:00–14:30</span>
<span style="display: flex; align-items: center; gap: 6px">${icon("video", 16, c.sidebarMuted)}Google Meet</span>
</div>
<div style="display: flex; gap: 8px; padding-top: 4px">
<button type="button" style="flex-grow: 1; height: 44px; border: 0; border-radius: ${r.md}px; background: ${c.primaryOnDark}; color: ${c.sidebar}; font: inherit; font-size: 15px; font-weight: ${w.semi}; display: flex; align-items: center; justify-content: center; gap: 8px">${icon("video", 18, c.sidebar, 2)}<span>参加する</span></button>
<button type="button" style="height: 44px; padding: 0 14px; border: 1px solid ${c.sidebarLine}; border-radius: ${r.md}px; background: ${c.sidebarActive}; color: ${c.sidebarTextActive}; font: inherit; font-size: 13px; display: flex; align-items: center; gap: 6px">${icon("bell", 16, c.sidebarText)}<span style="${numStyle(t)}">5分前にアラーム</span></button>
</div>
</section>
<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px">
${tile("2", "承認待ち", "いちばん早い: 10月6日")}
${tile("4", "未選択の新着", "選ぶと空き時間に反映")}
</div>
<section style="display: flex; flex-direction: column; gap: 8px">
<div style="display: flex; align-items: baseline; gap: 8px; padding: 0 4px">
<h2 style="margin: 0; font-size: 17px; font-weight: ${w.semi}">今日の予定</h2>
<span style="font-size: 13px; color: ${c.muted}; ${numStyle(t)}">4件</span>
</div>
<div style="background: ${c.bg}; border: 1px solid ${c.border}; border-radius: ${r.lg}px; overflow: hidden">
${rows}
</div>
</section>
</div>
<nav aria-label="タブ" style="flex-shrink: 0; height: 84px; box-sizing: border-box; display: flex; padding: 0 4px; background: ${c.bg}; border-top: 1px solid ${c.border}">
${tabs}
</nav>
</div>`,
  });
}

// ---------- 書き出し ----------

const boards = {};
const order = [];
const notes = {};
const ROW = 1320;
const keys = ["A", "B", "C"];

keys.forEach((key, i) => {
  const t = resolve(key, themes[key]);
  const y = i * ROW;
  const files = [
    [key === "A" ? "Main.dc.html" : `${key}-admin.dc.html`, adminHome(t), { x: 0, y, w: 1280, h: 800, title: `${key} 管理画面のホーム` }],
    [`${key}-booking.dc.html`, bookingPage(t), { x: 1360, y, w: 1280, h: 800, title: `${key} ゲストの予約ページ` }],
    [`${key}-app.dc.html`, appHome(t), { x: 2720, y, w: 390, h: 844, title: `${key} アプリのホーム` }],
  ];
  for (const [name, html, frame] of files) {
    writeFileSync(join(projectDir, name), html);
    boards[name] = frame;
    order.push(name);
  }
  notes[`row${key}`] = {
    x: 0,
    y: y - 260,
    text: `${key} ${t.name}: ${t.summary}`,
    kind: "title1",
    maxW: 3110,
  };
});

const canvas = {
  v: 3,
  createdOnFiles: { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, "Z") },
  title: "Slotto デザインの方向",
  launch: { view: "canvas" },
  pages: [],
  boards,
  order,
  notes,
  designSystems: [],
};
writeFileSync(join(projectDir, "canvas.json"), JSON.stringify(canvas, null, 2));
console.log("wrote", order.length, "artboards to", projectDir);
