import { Stack } from "expo-router";
import { NotificationBridge } from "@/features/notifications/notification-bridge";
import { strings } from "@/strings";

const t = strings.screens;

/** ログイン後の画面。下のタブと、タブから開く詳細画面 */
export default function AppLayout() {
  return (
    <>
      <NotificationBridge />
      <Stack screenOptions={{ headerBackButtonDisplayMode: "minimal" }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="bookings/index" options={{ title: t.bookings }} />
        <Stack.Screen name="bookings/[id]" options={{ title: t.booking }} />
        <Stack.Screen name="events/[id]" options={{ title: t.event }} />
        <Stack.Screen name="import" options={{ title: t.import }} />
        <Stack.Screen name="automations/new" options={{ title: t.newAutomation, presentation: "modal" }} />
        <Stack.Screen name="automations/[id]" options={{ title: t.automation }} />
        <Stack.Screen name="runs/index" options={{ title: t.runs }} />
        <Stack.Screen name="runs/[id]" options={{ title: t.run }} />
        <Stack.Screen name="connections" options={{ title: t.connections }} />
        <Stack.Screen name="notification-settings" options={{ title: t.notificationSettings }} />
      </Stack>
    </>
  );
}
