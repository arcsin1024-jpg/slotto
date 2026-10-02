import { color, type ColorName, fontSize, radius, space } from "@slotto/tokens";
import { DarkTheme, DefaultTheme, type Theme } from "expo-router";
import { useColorScheme } from "react-native";

/**
 * アプリの色と寸法。値は @slotto/tokens(Web と同じ元)から取り、ここでは直書きしない。
 * トークンはデザインの方向が決まったら S1 が置き換える。
 */

export type Colors = Record<ColorName, string>;

export function useColors(): Colors {
  return useColorScheme() === "dark" ? color.dark : color.light;
}

export function navigationTheme(scheme: "light" | "dark"): Theme {
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const c = color[scheme];
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: c.primary,
      background: c.surface,
      card: c.bg,
      text: c.text,
      border: c.border,
      notification: c.danger,
    },
  };
}

export { fontSize, radius, space };
