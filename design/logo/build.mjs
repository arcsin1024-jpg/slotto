// ロゴとアプリアイコンの SVG を書き出す。node design/logo/build.mjs
// 形: 線で組んだ小文字の「slotto」。2 つの「t」の横棒を 1 本の帯でつなぎ、予約枠に見立てる。
// 線の太さ 11、x ハイト 44(y 36〜80)。書体に頼らないので、どの環境でも同じ形になる。

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const C = {
  ink: "#121826", // color-text(ライト)
  blue: "#2456D3", // color-primary(ライト)
  white: "#FFFFFF",
  navy: "#131B31", // color-sidebar(ライト)
  lightBlue: "#87B1FD", // color-sidebar-accent
};

const LETTERS = {
  s: '<path d="M31 45C28 41.5 24 41.5 18 41.5C10 41.5 6 45 6 50C6 56 12 57.5 18.5 58.5C26 59.5 32 61.5 32 67.5C32 73 27 74.5 19 74.5C12 74.5 7 73 4 69"/>',
  l: '<path d="M48 21.5V74.5"/>',
  o1: '<circle cx="81.5" cy="58" r="16.5"/>',
  t1: '<path d="M115 24V65C115 71.5 118.5 74.5 125 74.5"/>',
  t2: '<path d="M142 24V65C142 71.5 145.5 74.5 152 74.5"/>',
  o2: '<circle cx="185.5" cy="58" r="16.5"/>',
};
const BAR = (color) => `<path d="M106 41.5H151" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round"/>`;
const strokes = (color, keys) =>
  `<g fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">${keys.map((k) => LETTERS[k]).join("")}</g>`;

function wordmark(ink, bar) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 10 220 76" width="220" height="76" role="img" aria-label="slotto">
${strokes(ink, ["s", "l", "o1", "t1", "t2", "o2"])}
${BAR(bar)}
</svg>
`;
}

// 記号: 「tt」だけを取り出したもの
function symbol(ink, bar) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="93.5 14.5 70 70" width="70" height="70" role="img" aria-label="slotto">
${strokes(ink, ["t1", "t2"])}
${BAR(bar)}
</svg>
`;
}

// アプリアイコン: 正方形いっぱいの地に記号を置く(角丸は OS がかける)
function appIcon(bg, ink, bar) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="1024" height="1024" role="img" aria-label="slotto">
<rect width="100" height="100" fill="${bg}"/>
<g transform="translate(50 51) scale(1.05) translate(-128.5 -49.25)">
${strokes(ink, ["t1", "t2"])}
${BAR(bar)}
</g>
</svg>
`;
}

const files = {
  "slotto-wordmark.svg": wordmark(C.ink, C.blue),
  "slotto-wordmark-on-dark.svg": wordmark(C.white, C.lightBlue),
  "slotto-wordmark-mono.svg": wordmark(C.ink, C.ink),
  "slotto-symbol.svg": symbol(C.ink, C.blue),
  "slotto-symbol-on-dark.svg": symbol(C.white, C.lightBlue),
  "app-icon-navy.svg": appIcon(C.navy, C.white, C.lightBlue),
  "app-icon-blue.svg": appIcon(C.blue, C.white, C.navy),
};

for (const [name, svg] of Object.entries(files)) writeFileSync(join(here, name), svg);
console.log("wrote", Object.keys(files).join(", "));
