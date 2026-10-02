import { DEFAULT_TIMEZONE } from "@slotto/core";
import type { Tables, TablesUpdate } from "@slotto/core/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { keys } from "./keys";
import { currentUserId, unwrap, unwrapMaybe } from "./util";

export type Profile = Tables<"profiles">;
export type UserSettings = Tables<"user_settings">;

export function useProfile() {
  return useQuery({
    queryKey: keys.profile,
    queryFn: async (): Promise<Profile> => {
      const id = await currentUserId();
      return unwrap(await supabase.from("profiles").select("*").eq("id", id).single());
    },
  });
}

/** 表示に使うタイムゾーン。プロフィールを読み込むまでは既定値 */
export function useTimeZone(): string {
  return useProfile().data?.timezone ?? DEFAULT_TIMEZONE;
}

/** 通知・アラームの初期値など(アプリ限定の設定を含む) */
export function useUserSettings() {
  return useQuery({
    queryKey: keys.userSettings,
    queryFn: async (): Promise<UserSettings | null> => {
      const id = await currentUserId();
      return unwrapMaybe(await supabase.from("user_settings").select("*").eq("user_id", id).maybeSingle());
    },
  });
}

export function useUpdateUserSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Omit<TablesUpdate<"user_settings">, "user_id" | "updated_at">): Promise<UserSettings> => {
      const user_id = await currentUserId();
      return unwrap(
        await supabase
          .from("user_settings")
          .upsert({ ...patch, user_id, updated_at: new Date().toISOString() })
          .select("*")
          .single(),
      );
    },
    onSuccess: (row) => {
      queryClient.setQueryData(keys.userSettings, row);
    },
  });
}
