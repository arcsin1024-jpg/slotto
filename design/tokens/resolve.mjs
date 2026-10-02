// source.mjs の色を HEX に直した一覧。{ "color-bg": { light, dark, usage }, "page-blue": {...} }
import { oklch } from "../lib/color.mjs";
import * as src from "./source.mjs";

const toHex = (v) => (typeof v === "string" ? v : oklch(...v));

export function resolveColors() {
  const out = {};
  for (const [name, t] of Object.entries(src.color))
    out[`color-${name}`] = { light: toHex(t.value[0]), dark: toHex(t.value[1]), usage: t.usage };
  for (const [name, t] of Object.entries(src.page))
    out[`page-${name}`] = { light: toHex(t.value[0]), dark: toHex(t.value[1]), usage: t.usage };
  return out;
}

/** テーマ 1 つ分の色。{ "color-bg": "#FFFFFF", ... } */
export function themeColors(theme) {
  return Object.fromEntries(Object.entries(resolveColors()).map(([k, v]) => [k, v[theme]]));
}
