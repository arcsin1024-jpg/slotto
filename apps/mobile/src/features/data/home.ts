import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { type AgendaItem, fetchAgenda } from "./agenda";
import { keys } from "./keys";

export interface HomeData {
  /** これから始まる(または進行中の)いちばん近い予定 */
  next: AgendaItem | null;
  /** 今日の予定(端末の日付で 0 時から 24 時) */
  today: AgendaItem[];
  /** 承認待ちの件数 */
  pendingCount: number;
}

/** ホームに出すもの。未選択の新着の件数は useNewEventCount */
export function useHome() {
  return useQuery({
    queryKey: keys.home,
    queryFn: async (): Promise<HomeData> => {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(startOfDay.getTime() + 86_400_000);
      // 次の予定は 2 週間先まで探す
      const horizon = new Date(now.getTime() + 14 * 86_400_000);

      const [today, upcoming, pending] = await Promise.all([
        fetchAgenda(startOfDay.toISOString(), endOfDay.toISOString()),
        fetchAgenda(now.toISOString(), horizon.toISOString()),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
          .gt("ends_at", now.toISOString()),
      ]);
      if (pending.error) throw pending.error;

      return {
        next: upcoming.find((item) => !item.isAllDay) ?? null,
        today,
        pendingCount: pending.count ?? 0,
      };
    },
    refetchInterval: 60_000,
  });
}
