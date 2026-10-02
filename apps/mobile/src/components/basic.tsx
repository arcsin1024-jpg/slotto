/**
 * 仮の部品。デザインが決まるまで、画面の骨組みと動作の確認に使う。
 * モックの確認が済んだら、デザインに沿った部品に置き換える。
 */
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  type TextProps,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fontSize, radius, space, useColors } from "@/theme";

/** 画面の入れ物。tab は見出しの無いタブの画面(上の安全領域をあける) */
export function Screen({
  children,
  refreshing,
  onRefresh,
  tab,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  tab?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ backgroundColor: c.surface }}
      contentContainerStyle={[styles.screen, tab ? { paddingTop: insets.top + space[4] } : null]}
      contentInsetAdjustmentBehavior={tab ? "never" : "automatic"}
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.heading, { color: c.text }]}>{children}</Text>;
}

export function Body({ children, muted, style, ...props }: TextProps & { muted?: boolean }) {
  const c = useColors();
  return (
    <Text style={[styles.body, { color: muted ? c.textMuted : c.text }, style]} {...props}>
      {children}
    </Text>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surfaceRaised, borderColor: c.border }]}>{children}</View>;
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, { borderColor: c.border, opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={styles.rowText}>
        <Text style={[styles.body, { color: c.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.small, { color: c.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

export function Button({
  label,
  variant = "primary",
  loading,
  disabled,
  ...props
}: PressableProps & { label: string; variant?: "primary" | "secondary" | "danger"; loading?: boolean }) {
  const c = useColors();
  const background = variant === "primary" ? c.primary : variant === "danger" ? c.danger : c.surfaceRaised;
  const foreground = variant === "secondary" ? c.text : c.primaryText;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: c.borderStrong, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={foreground} /> : <Text style={[styles.buttonText, { color: foreground }]}>{label}</Text>}
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.center}>
      <ActivityIndicator />
    </View>
  );
}

export function ErrorText({ error }: { error: unknown }) {
  const c = useColors();
  const message = error instanceof Error ? error.message : "読み込めませんでした";
  return <Text style={[styles.body, { color: c.danger }]}>{message}</Text>;
}

const styles = StyleSheet.create({
  screen: { padding: space[4], gap: space[3] },
  heading: { fontSize: fontSize.xl, fontWeight: "700" },
  body: { fontSize: fontSize.md },
  small: { fontSize: fontSize.sm },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: space[4], gap: space[2] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[3],
    paddingVertical: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: space[1] },
  button: {
    minHeight: 44,
    paddingHorizontal: space[4],
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: fontSize.md, fontWeight: "700" },
  center: { padding: space[8], alignItems: "center" },
});
