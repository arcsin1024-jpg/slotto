// デザイントークン(仮の値)。
// デザインの方向が決まったら S1(デザイン担当)が置き換える。名前は変えない。
// Web 用の tokens.css と同じ名前・同じ値にすること。

export const color = {
  light: {
    bg: "#FFFFFF",
    surface: "#F7F8FA",
    surfaceRaised: "#FFFFFF",
    sidebar: "#1B2333",
    sidebarText: "#C9D1E0",
    sidebarTextActive: "#FFFFFF",
    sidebarActive: "#2A3550",
    primary: "#2F6BFF",
    primaryHover: "#2559DB",
    primaryText: "#FFFFFF",
    primarySoft: "#EAF0FF",
    text: "#1A1F2B",
    textMuted: "#5B6475",
    textSubtle: "#8A93A3",
    border: "#E3E6EC",
    borderStrong: "#C9CED8",
    success: "#1F9D62",
    warning: "#B7791F",
    danger: "#D43C3C",
    info: "#2F6BFF",
  },
  dark: {
    bg: "#0F131B",
    surface: "#161B25",
    surfaceRaised: "#1D2330",
    sidebar: "#0B0E14",
    sidebarText: "#A7B0C0",
    sidebarTextActive: "#FFFFFF",
    sidebarActive: "#1D2330",
    primary: "#5B8CFF",
    primaryHover: "#7AA2FF",
    primaryText: "#0B0E14",
    primarySoft: "#1B2540",
    text: "#EEF1F6",
    textMuted: "#A7B0C0",
    textSubtle: "#7B8496",
    border: "#262D3B",
    borderStrong: "#374052",
    success: "#3CC486",
    warning: "#E0A93B",
    danger: "#F06A6A",
    info: "#5B8CFF",
  },
} as const;

// 予約ページの色分け
export const pageColor = {
  blue: "#2F6BFF",
  green: "#1F9D62",
  teal: "#0E9AA7",
  purple: "#7A5AF8",
  pink: "#D6409F",
  orange: "#E8590C",
  yellow: "#B7791F",
  gray: "#5B6475",
} as const;

export const radius = { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 } as const;

export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
} as const;

export const lineHeight = { tight: 1.3, normal: 1.6, relaxed: 1.8 } as const;

export const fontWeight = { regular: "400", medium: "500", bold: "700" } as const;

export type ColorScheme = keyof typeof color;
export type ColorName = keyof (typeof color)["light"];
export type PageColorName = keyof typeof pageColor;
