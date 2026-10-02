// 色の計算。OKLCH から sRGB の HEX を出し、WCAG 2.x のコントラスト比を求める。
// 依存パッケージなし。design/ と packages/tokens/ のスクリプトから使う。

const clamp01 = (v) => Math.min(1, Math.max(0, v));

function linearToSrgb(v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
}

function srgbToLinear(v) {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** OKLCH(L: 0〜1、C: 彩度、H: 色相の角度)を linear sRGB にする */
function oklchToLinear(l, c, h) {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;
  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;
  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ];
}

/** sRGB の色域に入っているか(わずかな誤差は許す) */
export function inGamut(l, c, h) {
  return oklchToLinear(l, c, h).every((v) => v >= -0.0005 && v <= 1.0005);
}

/** OKLCH を HEX にする。色域の外なら、色域に入るまで彩度を下げる */
export function oklch(l, c, h) {
  let chroma = c;
  while (chroma > 0 && !inGamut(l, chroma, h)) chroma -= 0.002;
  const rgb = oklchToLinear(l, Math.max(0, chroma), h).map((v) =>
    Math.round(clamp01(linearToSrgb(clamp01(v))) * 255),
  );
  return "#" + rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}

export function hexToRgb(hex) {
  const s = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
}

/** 相対輝度(WCAG 2.x) */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => srgbToLinear(v / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** コントラスト比(WCAG 2.x)。4.5 以上で本文の AA、3 以上で大きい文字と図形の AA */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** 前景色を、背景の上に不透明度 alpha で重ねたときの色 */
export function mix(fg, bg, alpha) {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  const out = f.map((v, i) => Math.round(v * alpha + b[i] * (1 - alpha)));
  return "#" + out.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();
}
