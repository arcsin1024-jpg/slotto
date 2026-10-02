// Slotto のデザイントークン。
// このファイルは design/tokens/build.mjs が design/tokens/source.mjs から生成する。直接書き換えない。
// Web 用の tokens.css と同じ名前・同じ値(CSS の --color-text-muted は color.light.textMuted)。

export const color = {
  light: {
    bg: "#FFFFFF",
    surface: "#F5F7FA",
    surfaceRaised: "#FFFFFF",
    surfaceHover: "#EEF0F4",
    overlay: "rgba(15, 20, 35, 0.48)",
    sidebar: "#131B31",
    sidebarHover: "#1B2540",
    sidebarActive: "#232F4F",
    sidebarBorder: "#283045",
    sidebarText: "#BCC4D5",
    sidebarTextActive: "#FFFFFF",
    sidebarTextMuted: "#8F98AB",
    sidebarAccent: "#87B1FD",
    primary: "#2456D3",
    primaryHover: "#1844B9",
    primaryPressed: "#12389E",
    primaryText: "#FFFFFF",
    primarySoft: "#E9F0FF",
    primaryInk: "#1D4BC0",
    text: "#121826",
    textMuted: "#535B6C",
    textSubtle: "#686F7E",
    textInverse: "#FFFFFF",
    border: "#E4E6EA",
    borderStrong: "#CACED6",
    borderControl: "#868C99",
    focusRing: "#3266E4",
    success: "#0B7643",
    successSoft: "#E3F8E9",
    warning: "#8A5601",
    warningSoft: "#FEF0D4",
    danger: "#BE2323",
    dangerHover: "#A50E15",
    dangerText: "#FFFFFF",
    dangerSoft: "#FEEEEB",
    info: "#026A9D",
    infoSoft: "#E6F4FE",
  },
  dark: {
    bg: "#11141A",
    surface: "#0A0C11",
    surfaceRaised: "#1A1E26",
    surfaceHover: "#20242C",
    overlay: "rgba(0, 0, 0, 0.6)",
    sidebar: "#050810",
    sidebarHover: "#0F1320",
    sidebarActive: "#192032",
    sidebarBorder: "#191D27",
    sidebarText: "#B8BECA",
    sidebarTextActive: "#FFFFFF",
    sidebarTextMuted: "#868C99",
    sidebarAccent: "#87B1FD",
    primary: "#6D9DF5",
    primaryHover: "#87B1FD",
    primaryPressed: "#A0C1FE",
    primaryText: "#090F1C",
    primarySoft: "#172544",
    primaryInk: "#9BBEFF",
    text: "#ECEEF3",
    textMuted: "#ABB1BD",
    textSubtle: "#9095A1",
    textInverse: "#090F1C",
    border: "#272A31",
    borderStrong: "#3B404A",
    borderControl: "#6C727E",
    focusRing: "#7DAAFD",
    success: "#5CCB89",
    successSoft: "#122D1D",
    warning: "#EFB656",
    warningSoft: "#35260C",
    danger: "#F5746D",
    dangerHover: "#FE8B83",
    dangerText: "#090F1C",
    dangerSoft: "#3E1E1C",
    info: "#6BBEF2",
    infoSoft: "#0E293A",
  },
} as const;

// 予約ページの色分け。-Soft は予定のチップの地
export const pageColor = {
  light: {
    blue: "#2A76C3",
    blueSoft: "#E4F0FE",
    green: "#048B56",
    greenSoft: "#DCF6E6",
    teal: "#07858A",
    tealSoft: "#D4F6F8",
    purple: "#7C60BD",
    purpleSoft: "#EFECFE",
    pink: "#AF4D80",
    pinkSoft: "#FFE7F1",
    orange: "#B35713",
    orangeSoft: "#FEEADF",
    yellow: "#9A7403",
    yellowSoft: "#F9EDD5",
    gray: "#6F7581",
    graySoft: "#ECEEF4",
  },
  dark: {
    blue: "#70AFF4",
    blueSoft: "#1A2F46",
    green: "#61C28E",
    greenSoft: "#153524",
    teal: "#24C1C9",
    tealSoft: "#023538",
    purple: "#B09BEE",
    purpleSoft: "#302844",
    pink: "#E38AB5",
    pinkSoft: "#412331",
    orange: "#E79363",
    orangeSoft: "#422616",
    yellow: "#CDA448",
    yellowSoft: "#392C0C",
    gray: "#A5ABB8",
    graySoft: "#2B2E34",
  },
} as const;

export const pageColorNames = ["blue","green","teal","purple","pink","orange","yellow","gray"] as const;

export const font = {
  /** Web で読み込む Google Fonts */
  url: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Noto+Sans+JP:wght@400;500;600;700&display=swap",
  sans: "Geist, \"Noto Sans JP\", \"Hiragino Sans\", \"Yu Gothic UI\", system-ui, sans-serif",
  mono: "\"Geist Mono\", ui-monospace, \"SFMono-Regular\", Menlo, monospace",
  /** アプリは端末の書体を使う */
  native: {"sans":"System","mono":"Menlo"},
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 38,
  "5xl": 48,
} as const;

export const lineHeight = {
  tight: 1.25,
  snug: 1.4,
  normal: 1.6,
  relaxed: 1.8,
} as const;

export const fontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const letterSpacing = {
  tight: "-0.02em",
  snug: "-0.01em",
  normal: "0em",
  wide: "0.04em",
} as const;

/** 文字の組み。lineHeight は px */
export const textStyle = {
  "display": { fontSize: 48, lineHeight: 56, fontWeight: "600", letterSpacing: "-0.02em" },
  "title-1": { fontSize: 30, lineHeight: 40, fontWeight: "600", letterSpacing: "-0.02em" },
  "title-2": { fontSize: 24, lineHeight: 32, fontWeight: "600", letterSpacing: "-0.01em" },
  "title-3": { fontSize: 20, lineHeight: 28, fontWeight: "600", letterSpacing: "-0.01em" },
  "heading": { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  "body-lg": { fontSize: 15, lineHeight: 24, fontWeight: "400" },
  "body": { fontSize: 14, lineHeight: 22, fontWeight: "400" },
  "body-strong": { fontSize: 14, lineHeight: 22, fontWeight: "500" },
  "small": { fontSize: 13, lineHeight: 20, fontWeight: "400" },
  "caption": { fontSize: 12, lineHeight: 18, fontWeight: "400" },
  "time": { fontSize: 14, lineHeight: 20, fontWeight: "500" },
  "count": { fontSize: 24, lineHeight: 30, fontWeight: "600", letterSpacing: "-0.01em" },
  "code": { fontSize: 13, lineHeight: 20, fontWeight: "400", family: "mono" },
} as const;

export const space = {
  "0": 0,
  "1": 4,
  "2": 8,
  "3": 12,
  "4": 16,
  "5": 20,
  "6": 24,
  "8": 32,
  "10": 40,
  "12": 48,
  "16": 64,
  "20": 80,
  "24": 96,
  "0.5": 2,
  "1.5": 6,
} as const;

export const radius = {
  sm: 4,
  md: 6,
  lg: 10,
  xl: 14,
  full: 9999,
} as const;

export const borderWidth = {
  "1": 1,
  "2": 2,
} as const;

export const shadow = {
  light: {
    sm: "0 1px 2px rgba(16, 24, 40, 0.06)",
    md: "0 1px 3px rgba(16, 24, 40, 0.06), 0 6px 16px rgba(16, 24, 40, 0.08)",
    lg: "0 2px 6px rgba(16, 24, 40, 0.08), 0 16px 40px rgba(16, 24, 40, 0.16)",
  },
  dark: {
    sm: "0 1px 2px rgba(0, 0, 0, 0.4)",
    md: "0 1px 3px rgba(0, 0, 0, 0.4), 0 6px 16px rgba(0, 0, 0, 0.35)",
    lg: "0 2px 6px rgba(0, 0, 0, 0.5), 0 16px 40px rgba(0, 0, 0, 0.5)",
  },
} as const;

export const motion = {
  duration: {
    fast: 100,
    base: 160,
    slow: 240,
  },
  easing: {
    out: "cubic-bezier(0.2, 0.8, 0.2, 1)",
    inOut: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

export const layout = {
  sidebarWidth: 240,
  sidebarCollapsed: 64,
  headerHeight: 56,
  panelWidth: 400,
  contentMaxWidth: 1200,
  tabBarHeight: 56,
} as const;

export type ColorScheme = keyof typeof color;
export type ColorName = keyof (typeof color)["light"];
export type PageColorName = (typeof pageColorNames)[number];
export type TextStyleName = keyof typeof textStyle;
