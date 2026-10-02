import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { SessionProvider, useSession } from "@/features/auth/session-provider";
import { queryClient } from "@/lib/query-client";
import { navigationTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme() === "dark" ? "dark" : "light";
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={navigationTheme(scheme)}>
          <SplashScreenController />
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/** 保存済みのセッションを読み終えるまで、起動画面を出したままにする */
function SplashScreenController() {
  const { isLoading } = useSession();
  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);
  return null;
}

function RootNavigator() {
  const { session } = useSession();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      {/* メールのリンクと Google のログインの戻り先。ログインの前後どちらでも開ける */}
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}
