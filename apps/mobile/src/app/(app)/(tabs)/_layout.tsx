import { NativeTabs } from "expo-router/unstable-native-tabs";
import { strings } from "@/strings";
import { useColors } from "@/theme";

const t = strings.tabs;

/** 下のタブ: ホーム・カレンダー・予約ページ・オートメーション・設定 */
export default function TabsLayout() {
  const c = useColors();
  return (
    <NativeTabs backgroundColor={c.bg} indicatorColor={c.primarySoft} labelStyle={{ selected: { color: c.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>{t.home}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendar">
        <NativeTabs.Trigger.Label>{t.calendar}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="pages">
        <NativeTabs.Trigger.Label>{t.pages}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="link" md="link" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="automations">
        <NativeTabs.Trigger.Label>{t.automations}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bolt" md="bolt" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>{t.settings}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
