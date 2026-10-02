import { EXTERNAL_EVENT_WINDOW_DAYS, type EventSelectionInput } from "@slotto/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { ExternalEvent } from "./agenda";
import { keys } from "./keys";
import { unwrap } from "./util";

export function useExternalEvent(id: string) {
  return useQuery({
    queryKey: keys.externalEvent(id),
    queryFn: async (): Promise<ExternalEvent> =>
      unwrap(await supabase.from("external_events").select("*").eq("id", id).single()),
  });
}

/** 取り込み画面の絞り込み */
export type ImportFilter = "new" | "unselected" | "selected" | "all";

/** 取り込み画面に並べる外部予定。今日から 90 日先まで、開始時刻の順 */
export function useImportEvents(filter: ImportFilter, calendarId: string | null = null) {
  return useQuery({
    queryKey: keys.importEvents(`${filter}:${calendarId ?? "all"}`),
    queryFn: async (): Promise<ExternalEvent[]> => {
      const now = new Date();
      const until = new Date(now.getTime() + EXTERNAL_EVENT_WINDOW_DAYS * 86_400_000);
      let query = supabase
        .from("external_events")
        .select("*")
        .gt("ends_at", now.toISOString())
        .lt("starts_at", until.toISOString());
      if (filter === "new") query = query.eq("is_selected", false).is("seen_at", null);
      if (filter === "unselected") query = query.eq("is_selected", false);
      if (filter === "selected") query = query.eq("is_selected", true);
      if (calendarId) query = query.eq("calendar_id", calendarId);
      return unwrap(await query.order("starts_at").limit(500));
    },
  });
}

/** 未選択の新着の件数(ホームの表示用) */
export function useNewEventCount() {
  return useQuery({
    queryKey: keys.newEventCount,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("external_events")
        .select("id", { count: "exact", head: true })
        .eq("is_selected", false)
        .is("seen_at", null)
        .gt("ends_at", new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function invalidateEvents(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: keys.importEventsAll });
  void queryClient.invalidateQueries({ queryKey: keys.newEventCount });
  void queryClient.invalidateQueries({ queryKey: keys.agendaAll });
  void queryClient.invalidateQueries({ queryKey: keys.home });
}

/**
 * 外部予定の選択・解除。繰り返しの扱いや空き枠への反映があるので Web の API を呼ぶ
 * (POST /api/external-events/selection)。
 */
export function useEventSelection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: EventSelectionInput) => api.post("/api/external-events/selection", input),
    onSettled: (_data, _error, input) => {
      for (const id of input.event_ids) void queryClient.invalidateQueries({ queryKey: keys.externalEvent(id) });
      invalidateEvents(queryClient);
    },
  });
}

/** 新着を見たことにする(「未選択の新着」の件数から外す)。選択の状態は変えない */
export function useMarkEventsSeen() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (eventIds: string[]) => {
      if (eventIds.length === 0) return;
      unwrap(
        await supabase
          .from("external_events")
          .update({ seen_at: new Date().toISOString() })
          .in("id", eventIds)
          .is("seen_at", null),
      );
    },
    // 開いている一覧は読み直さない(見ている途中で新着の一覧から消えないように)。件数だけ更新する
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.newEventCount });
    },
  });
}

/** 外部予定を読み込み直す(POST /api/calendar/sync) */
export function useCalendarSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/calendar/sync"),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.externalCalendars });
      invalidateEvents(queryClient);
    },
  });
}
