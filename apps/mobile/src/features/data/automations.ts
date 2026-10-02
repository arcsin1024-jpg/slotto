import {
  type AutomationActionResult,
  automationActionResultSchema,
  type AutomationInput,
  automationInputSchema,
  type ApiConnectionConfig,
  type ApiConnectionInput,
  apiConnectionConfigSchema,
  apiConnectionInputSchema,
  automationActionsSchema,
  automationTargetSchema,
  automationTriggerSchema,
} from "@slotto/core";
import type { Tables } from "@slotto/core/database";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { keys } from "./keys";
import { currentUserId, DataError, parseJson, unwrap } from "./util";

/** オートメーション。JSON の列は @slotto/core の型に直したもの(読めない列は null) */
export interface Automation extends Omit<Tables<"automations">, "trigger" | "target" | "actions"> {
  trigger: AutomationInput["trigger"] | null;
  target: AutomationInput["target"] | null;
  actions: AutomationInput["actions"] | null;
}

export interface AutomationRun extends Omit<Tables<"automation_runs">, "results"> {
  results: AutomationActionResult[];
}

export type ApiConnection = Tables<"api_connections"> & {
  parsedConfig: ApiConnectionConfig | null;
};

function toAutomation(row: Tables<"automations">): Automation {
  return {
    ...row,
    trigger: parseJson(automationTriggerSchema, row.trigger),
    target: parseJson(automationTargetSchema, row.target),
    actions: parseJson(automationActionsSchema, row.actions),
  };
}

function toRun(row: Tables<"automation_runs">): AutomationRun {
  return { ...row, results: parseJson(automationActionResultSchema.array(), row.results) ?? [] };
}

export function useAutomations() {
  return useQuery({
    queryKey: keys.automations,
    queryFn: async () =>
      unwrap(await supabase.from("automations").select("*").order("created_at")).map(toAutomation),
  });
}

export function useAutomation(id: string) {
  return useQuery({
    queryKey: keys.automation(id),
    queryFn: async () => toAutomation(unwrap(await supabase.from("automations").select("*").eq("id", id).single())),
  });
}

/**
 * オートメーションの作成・更新。入力は @slotto/core の automationInputSchema で確かめる。
 * 時刻が来たときの実行はサーバー(S4 の実行基盤)が automations 表を見て行う。
 */
export function useSaveAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: unknown }) => {
      const parsed = automationInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new DataError(parsed.error.issues[0]?.message ?? "入力を確かめてください", "invalid_input");
      }
      const values = parsed.data;
      if (id) {
        return toAutomation(
          unwrap(await supabase.from("automations").update(values).eq("id", id).select("*").single()),
        );
      }
      const user_id = await currentUserId();
      return toAutomation(
        unwrap(await supabase.from("automations").insert({ ...values, user_id }).select("*").single()),
      );
    },
    onSuccess: (row) => {
      queryClient.setQueryData(keys.automation(row.id), row);
      void queryClient.invalidateQueries({ queryKey: keys.automations });
    },
  });
}

export function useSetAutomationEnabled() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) =>
      toAutomation(
        unwrap(await supabase.from("automations").update({ is_enabled: isEnabled }).eq("id", id).select("*").single()),
      ),
    onSuccess: (row) => {
      queryClient.setQueryData(keys.automation(row.id), row);
      queryClient.setQueryData<Automation[]>(keys.automations, (list) =>
        list?.map((item) => (item.id === row.id ? row : item)),
      );
    },
  });
}

export function useDeleteAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from("automations").delete().eq("id", id));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.automations });
      void queryClient.invalidateQueries({ queryKey: keys.automationRunsAll });
    },
  });
}

/** 試し実行(POST /api/automations/{id}/test)。結果は実行履歴に残り、通知でも届く */
export function useTestAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/automations/${id}/test`),
    onSettled: (_data, _error, id) => {
      void queryClient.invalidateQueries({ queryKey: keys.automationRuns(id) });
      void queryClient.invalidateQueries({ queryKey: keys.automationRuns(null) });
    },
  });
}

/** 実行履歴。automationId が null なら全部。新しい順 */
export function useAutomationRuns(automationId: string | null, limit = 50) {
  return useQuery({
    queryKey: keys.automationRuns(automationId),
    queryFn: async () => {
      let query = supabase.from("automation_runs").select("*");
      if (automationId) query = query.eq("automation_id", automationId);
      return unwrap(await query.order("scheduled_for", { ascending: false }).limit(limit)).map(toRun);
    },
  });
}

export function useAutomationRun(id: string) {
  return useQuery({
    queryKey: keys.automationRun(id),
    queryFn: async () => toRun(unwrap(await supabase.from("automation_runs").select("*").eq("id", id).single())),
  });
}

// 接続先(Webhook、AI)

export function useConnections() {
  return useQuery({
    queryKey: keys.connections,
    queryFn: async (): Promise<ApiConnection[]> =>
      unwrap(await supabase.from("api_connections").select("*").order("created_at")).map((row) => ({
        ...row,
        parsedConfig: parseJson(apiConnectionConfigSchema, row.config),
      })),
  });
}

/** 接続先の登録。秘密の値を含むので Web の API で暗号化して保存する(POST /api/connections) */
export function useCreateConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ApiConnectionInput) => {
      const parsed = apiConnectionInputSchema.safeParse(input);
      if (!parsed.success) {
        throw new DataError(parsed.error.issues[0]?.message ?? "入力を確かめてください", "invalid_input");
      }
      return api.post("/api/connections", parsed.data);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.connections }),
  });
}

/** 接続先の削除(自分の行は直接消せる。秘密の値は外部キーで一緒に消える) */
export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      unwrap(await supabase.from("api_connections").delete().eq("id", id));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: keys.connections }),
  });
}
