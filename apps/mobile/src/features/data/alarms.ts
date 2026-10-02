import type { Tables } from "@slotto/core/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { keys } from "./keys";
import { currentUserId, unwrap, unwrapMaybe } from "./util";

/** 予定ごとの通知・アラームの個別設定(event_alarms)。無ければ全体の初期値を使う */
export type EventAlarm = Tables<"event_alarms">;
export type AlarmSourceType = EventAlarm["source_type"];

export function useEventAlarm(sourceType: AlarmSourceType, sourceId: string) {
  return useQuery({
    queryKey: keys.eventAlarm(sourceType, sourceId),
    queryFn: async (): Promise<EventAlarm | null> =>
      unwrapMaybe(
        await supabase
          .from("event_alarms")
          .select("*")
          .eq("source_type", sourceType)
          .eq("source_id", sourceId)
          .maybeSingle(),
      ),
  });
}

/** 通知の張り直しに使う、個別設定の全部 */
export async function fetchEventAlarms(sourceIds: string[]): Promise<EventAlarm[]> {
  if (sourceIds.length === 0) return [];
  return unwrap(await supabase.from("event_alarms").select("*").in("source_id", sourceIds));
}

export function useSaveEventAlarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      sourceType: AlarmSourceType;
      sourceId: string;
      notifyMinutes: number[];
      alarmMinutes: number[];
      isMuted: boolean;
    }): Promise<EventAlarm> => {
      const user_id = await currentUserId();
      return unwrap(
        await supabase
          .from("event_alarms")
          .upsert(
            {
              user_id,
              source_type: input.sourceType,
              source_id: input.sourceId,
              notify_minutes: input.notifyMinutes,
              alarm_minutes: input.alarmMinutes,
              is_muted: input.isMuted,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,source_type,source_id" },
          )
          .select("*")
          .single(),
      );
    },
    onSuccess: (row) => {
      queryClient.setQueryData(keys.eventAlarm(row.source_type, row.source_id), row);
      void queryClient.invalidateQueries({ queryKey: keys.eventAlarms });
    },
  });
}

/** 個別設定をやめて、全体の初期値に戻す */
export function useResetEventAlarm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceType, sourceId }: { sourceType: AlarmSourceType; sourceId: string }) => {
      unwrap(await supabase.from("event_alarms").delete().eq("source_type", sourceType).eq("source_id", sourceId));
    },
    onSuccess: (_data, { sourceType, sourceId }) => {
      queryClient.setQueryData(keys.eventAlarm(sourceType, sourceId), null);
      void queryClient.invalidateQueries({ queryKey: keys.eventAlarms });
    },
  });
}
