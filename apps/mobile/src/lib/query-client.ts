import { focusManager, QueryClient } from "@tanstack/react-query";
import { AppState, Platform } from "react-native";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
    mutations: { retry: 0 },
  },
});

// アプリが前面に戻ったら、古くなったデータを読み直す
AppState.addEventListener("change", (state) => {
  if (Platform.OS !== "web") focusManager.setFocused(state === "active");
});
