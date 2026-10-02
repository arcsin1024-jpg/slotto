// source.mjs からトークンを書き出す。
//   node design/tokens/build.mjs --check              コントラストの確認だけ
//   node design/tokens/build.mjs --ds <フォルダ>        Design System 用の tokens.json を書く
//   node design/tokens/build.mjs --packages           packages/tokens/src の tokens.css と index.ts を書く
// どの場合も、先にコントラストを確かめ、足りない組み合わせがあれば止まる。

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { contrast } from "../lib/color.mjs";
import * as src from "./source.mjs";
import { resolveColors } from "./resolve.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const args = process.argv.slice(2);

const THEMES = ["light", "dark"];

const colors = resolveColors();

// ---------- コントラストの確認 ----------

function key(name) {
  if (colors[`color-${name}`]) return `color-${name}`;
  if (colors[name]) return name;
  throw new Error(`色の名前が見つかりません: ${name}`);
}

let failed = 0;
const report = [];
for (const theme of THEMES) {
  for (const [fg, bg, min] of src.contrastChecks) {
    const f = colors[key(fg)][theme];
    const b = colors[key(bg)][theme];
    if (f.startsWith("rgba") || b.startsWith("rgba")) continue;
    const r = contrast(f, b);
    if (r < min) {
      failed++;
      report.push(`NG ${theme.padEnd(5)} ${fg} on ${bg}: ${r.toFixed(2)} (必要 ${min})`);
    }
  }
}
const total = src.contrastChecks.length * THEMES.length;
console.log(`コントラスト: ${total - failed}/${total} 組が基準を満たす`);
for (const line of report) console.log("  " + line);
if (failed) process.exit(1);

// ---------- 書き出し ----------

const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const cssNum = (n) => String(n).replace(".", "\\.");

function writeDs(dir) {
  const project = join(dir, "project");
  mkdirSync(project, { recursive: true });
  const tokens = {
    name: "Slotto",
    version: 1,
    color: {
      themes: [
        { id: "light", name: "ライト" },
        { id: "dark", name: "ダーク" },
      ],
      tokens: Object.entries(colors).map(([name, c]) => ({ name, value: { light: c.light, dark: c.dark }, usage: c.usage })),
    },
    type: {
      fonts: [],
      families: { sans: src.font.sans, mono: src.font.mono },
      groups: ["見出し", "本文", "数字"].map((g) => ({
        name: g,
        family: "sans",
        styles: src.textStyles
          .filter((s) => s.group === g)
          .map((s) => ({
            name: s.name,
            ...(s.family ? { family: s.family } : {}),
            fontSize: `${s.fontSize}px`,
            lineHeight: `${s.lineHeight}px`,
            fontWeight: s.fontWeight,
            ...(s.letterSpacing ? { letterSpacing: s.letterSpacing } : {}),
            sample: s.sample,
            usage: s.usage,
          })),
      })),
    },
    spacing: {
      note: "4px 刻み。パネルの内側は space-4、行の上下は space-2〜3、章の間は space-6〜8",
      tokens: Object.entries(src.space).map(([k, v]) => ({ name: `space-${k}`, value: `${v}px`, usage: spaceUsage(k) })),
    },
    radius: {
      note: "小さめで段階を絞る",
      tokens: [
        { name: "radius-sm", value: `${src.radius.sm}px`, usage: "バッジ、キーの表示、チェックボックス" },
        { name: "radius-md", value: `${src.radius.md}px`, usage: "ボタン、入力欄、時間枠、サイドバーの項目" },
        { name: "radius-lg", value: `${src.radius.lg}px`, usage: "パネル、カード、ダイアログ" },
        { name: "radius-xl", value: `${src.radius.xl}px`, usage: "アプリのカード、予約ページの外枠" },
        { name: "radius-full", value: `${src.radius.full}px`, usage: "アバター、件数のバッジ、日付の丸" },
      ],
    },
    shadow: {
      note: "区切りは線と面の色差が基本。影は浮いているものだけ",
      tokens: Object.entries(src.shadow).map(([k, s]) => ({ name: `shadow-${k}`, value: { light: s.value[0], dark: s.value[1] }, usage: s.usage })),
    },
    borderWidth: {
      tokens: [
        { name: "border-width-1", value: "1px", usage: "区切り線、枠" },
        { name: "border-width-2", value: "2px", usage: "フォーカスの輪郭、選択中のタブの下線" },
      ],
    },
    layout: {
      tokens: Object.entries(src.layout).map(([k, v]) => ({ name: `layout-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}`, value: `${v}px`, usage: layoutUsage(k) })),
    },
  };
  writeFileSync(join(project, "tokens.json"), JSON.stringify(tokens, null, 2) + "\n");
  console.log("wrote", join(project, "tokens.json"));
}

function spaceUsage(k) {
  return (
    {
      0.5: "アイコンと数字の間など、ごく小さい間",
      1: "バッジの中、アイコンと文字の間",
      2: "行の上下、ボタンの並び",
      3: "一覧の行の上下",
      4: "パネルの内側、カードの内側",
      6: "パネルどうしの間、管理画面の左右の余白",
      8: "章の間",
      16: "紹介サイトの章の間",
    }[k] ?? "刻みの 1 段"
  );
}

function layoutUsage(k) {
  return (
    {
      sidebarWidth: "管理画面のサイドバーの幅",
      sidebarCollapsed: "畳んだサイドバーの幅(アイコンだけ)",
      headerHeight: "管理画面のヘッダーの高さ",
      panelWidth: "一覧の右に出す詳細パネルの幅",
      contentMaxWidth: "作業面の中身の最大幅",
      tabBarHeight: "アプリの下のタブの高さ(端末の安全域は別に足す)",
    }[k] ?? ""
  );
}

function writePackages() {
  const dir = join(repo, "packages/tokens/src");
  const head = `/*
 * Slotto のデザイントークン。
 * このファイルは design/tokens/build.mjs が design/tokens/source.mjs から生成する。直接書き換えない。
 * アプリ用の index.ts と同じ名前・同じ値。ライトは :root、ダークは .dark。
 */
`;
  const lightVars = Object.entries(colors).map(([n, c]) => `  --${n}: ${c.light};`);
  const darkVars = Object.entries(colors).map(([n, c]) => `  --${n}: ${c.dark};`);
  const shadowLight = Object.entries(src.shadow).map(([k, s]) => `  --shadow-${k}: ${s.value[0]};`);
  const shadowDark = Object.entries(src.shadow).map(([k, s]) => `  --shadow-${k}: ${s.value[1]};`);
  const css = `${head}
@import url("${src.font.url}");

:root {
  color-scheme: light;
${lightVars.join("\n")}

${shadowLight.join("\n")}

  --font-sans: ${src.font.sans};
  --font-mono: ${src.font.mono};
${Object.entries(src.fontSize).map(([k, v]) => `  --font-size-${k}: ${v}px;`).join("\n")}
${Object.entries(src.lineHeight).map(([k, v]) => `  --line-height-${k}: ${v};`).join("\n")}
${Object.entries(src.fontWeight).map(([k, v]) => `  --font-weight-${k}: ${v};`).join("\n")}
${Object.entries(src.letterSpacing).map(([k, v]) => `  --letter-spacing-${k}: ${v};`).join("\n")}

${Object.entries(src.space).map(([k, v]) => `  --space-${cssNum(k)}: ${v}px;`).join("\n")}

${Object.entries(src.radius).map(([k, v]) => `  --radius-${k}: ${v}px;`).join("\n")}

${Object.entries(src.borderWidth).map(([k, v]) => `  --border-width-${k}: ${v}px;`).join("\n")}

${Object.entries(src.motion.duration).map(([k, v]) => `  --duration-${k}: ${v}ms;`).join("\n")}
${Object.entries(src.motion.easing).map(([k, v]) => `  --easing-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}: ${v};`).join("\n")}

${Object.entries(src.layout).map(([k, v]) => `  --layout-${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}: ${v}px;`).join("\n")}
}

.dark {
  color-scheme: dark;
${darkVars.join("\n")}

${shadowDark.join("\n")}
}
`;
  writeFileSync(join(dir, "tokens.css"), css);

  const colorObj = (theme) =>
    Object.entries(src.color)
      .map(([n]) => `    ${camel(n)}: "${colors[`color-${n}`][theme]}",`)
      .join("\n");
  const pageObj = (theme) =>
    Object.keys(src.page)
      .map((n) => `    ${camel(n)}: "${colors[`page-${n}`][theme]}",`)
      .join("\n");
  const obj = (o, fmt = (v) => v) =>
    Object.entries(o)
      .map(([k, v]) => `  ${/^[a-z][A-Za-z0-9]*$/.test(k) ? k : JSON.stringify(k)}: ${fmt(v)},`)
      .join("\n");

  const ts = `// Slotto のデザイントークン。
// このファイルは design/tokens/build.mjs が design/tokens/source.mjs から生成する。直接書き換えない。
// Web 用の tokens.css と同じ名前・同じ値(CSS の --color-text-muted は color.light.textMuted)。

export const color = {
  light: {
${colorObj("light")}
  },
  dark: {
${colorObj("dark")}
  },
} as const;

// 予約ページの色分け。-Soft は予定のチップの地
export const pageColor = {
  light: {
${pageObj("light")}
  },
  dark: {
${pageObj("dark")}
  },
} as const;

export const pageColorNames = ${JSON.stringify(Object.keys(src.pageHues))} as const;

export const font = {
  /** Web で読み込む Google Fonts */
  url: ${JSON.stringify(src.font.url)},
  sans: ${JSON.stringify(src.font.sans)},
  mono: ${JSON.stringify(src.font.mono)},
  /** アプリは端末の書体を使う */
  native: ${JSON.stringify(src.font.native)},
} as const;

export const fontSize = {
${obj(src.fontSize)}
} as const;

export const lineHeight = {
${obj(src.lineHeight)}
} as const;

export const fontWeight = {
${obj(src.fontWeight, (v) => `"${v}"`)}
} as const;

export const letterSpacing = {
${obj(src.letterSpacing, (v) => `"${v}"`)}
} as const;

/** 文字の組み。lineHeight は px */
export const textStyle = {
${src.textStyles
  .map(
    (s) =>
      `  ${JSON.stringify(s.name)}: { fontSize: ${s.fontSize}, lineHeight: ${s.lineHeight}, fontWeight: "${s.fontWeight}"${s.letterSpacing ? `, letterSpacing: "${s.letterSpacing}"` : ""}${s.family === "mono" ? ', family: "mono"' : ""} },`,
  )
  .join("\n")}
} as const;

export const space = {
${obj(src.space)}
} as const;

export const radius = {
${obj(src.radius)}
} as const;

export const borderWidth = {
${obj(src.borderWidth)}
} as const;

export const shadow = {
  light: {
${Object.entries(src.shadow).map(([k, s]) => `    ${k}: "${s.value[0]}",`).join("\n")}
  },
  dark: {
${Object.entries(src.shadow).map(([k, s]) => `    ${k}: "${s.value[1]}",`).join("\n")}
  },
} as const;

export const motion = {
  duration: {
${obj(src.motion.duration, (v) => `${v}`).replace(/^/gm, "  ")}
  },
  easing: {
${obj(src.motion.easing, (v) => `"${v}"`).replace(/^/gm, "  ")}
  },
} as const;

export const layout = {
${obj(src.layout)}
} as const;

export type ColorScheme = keyof typeof color;
export type ColorName = keyof (typeof color)["light"];
export type PageColorName = (typeof pageColorNames)[number];
export type TextStyleName = keyof typeof textStyle;
`;
  writeFileSync(join(dir, "index.ts"), ts);
  console.log("wrote", join(dir, "tokens.css"), "and index.ts");
}

if (args.includes("--ds")) writeDs(args[args.indexOf("--ds") + 1]);
if (args.includes("--packages")) writePackages();
if (args.includes("--print")) {
  for (const [n, c] of Object.entries(colors)) console.log(n.padEnd(28), c.light, c.dark);
}
