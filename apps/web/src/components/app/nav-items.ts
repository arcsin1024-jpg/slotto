import { CalendarDays, Download, Home, Inbox, LayoutTemplate, Plug, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** 管理画面のサイドバー(docs/design.md の 4.3) */
export const NAV_ITEMS: NavItem[] = [
  { href: "/app", label: "ホーム", icon: Home },
  { href: "/app/pages", label: "予約ページ", icon: LayoutTemplate },
  { href: "/app/bookings", label: "予約", icon: Inbox },
  { href: "/app/calendar", label: "カレンダー", icon: CalendarDays },
  { href: "/app/import", label: "予定の取り込み", icon: Download },
  { href: "/app/integrations", label: "連携", icon: Plug },
  { href: "/app/settings", label: "設定", icon: Settings },
];
