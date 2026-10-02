import { z } from "zod";
import { timeStringSchema } from "./availability";

/**
 * オートメーション(アプリ限定の機能)。
 * 「いつ(trigger)」「何に対して(target)」「何をする(actions)」の組み合わせ。
 */

export const automationTriggerSchema = z.discriminatedUnion("type", [
  /** 開始の N 分前 */
  z.object({ type: z.literal("before_start"), offset_minutes: z.number().int().min(1).max(10080) }),
  /** 開始時刻 */
  z.object({ type: z.literal("at_start") }),
  /** 終了の N 分後(0 は終了時刻) */
  z.object({ type: z.literal("after_end"), offset_minutes: z.number().int().min(0).max(10080) }),
  /** 予約が入ったとき */
  z.object({ type: z.literal("booking_created") }),
  /** 予約がキャンセルされたとき */
  z.object({ type: z.literal("booking_cancelled") }),
  /** 毎日決まった時刻。weekdays は 0 が日曜 */
  z.object({
    type: z.literal("daily"),
    time: timeStringSchema,
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }),
]);

export type AutomationTrigger = z.infer<typeof automationTriggerSchema>;
export type AutomationTriggerType = AutomationTrigger["type"];

export const AUTOMATION_TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  before_start: "開始の前",
  at_start: "開始時刻",
  after_end: "終了の後",
  booking_created: "予約が入ったとき",
  booking_cancelled: "予約がキャンセルされたとき",
  daily: "毎日決まった時刻",
};

export const automationTargetSchema = z.discriminatedUnion("scope", [
  /** 予約と、反映中の外部予定の両方 */
  z.object({ scope: z.literal("all") }),
  /** 予約だけ */
  z.object({ scope: z.literal("bookings") }),
  /** 反映中の外部予定だけ */
  z.object({ scope: z.literal("selected_events") }),
  /** 特定の予約ページの予約だけ */
  z.object({ scope: z.literal("booking_page"), booking_page_id: z.uuid() }),
]);

export type AutomationTarget = z.infer<typeof automationTargetSchema>;

/**
 * 文面の差し込み。`{{title}}` のように書く。
 * daily トリガーでは、その日の予定の一覧が `{{agenda}}` に入る。
 */
export const AUTOMATION_VARIABLES = [
  { key: "title", label: "予定のタイトル" },
  { key: "start", label: "開始日時" },
  { key: "end", label: "終了日時" },
  { key: "guest_name", label: "相手の名前" },
  { key: "guest_email", label: "相手のメール" },
  { key: "location", label: "場所" },
  { key: "meeting_url", label: "会議 URL" },
  { key: "answers", label: "予約フォームの回答" },
  { key: "agenda", label: "その日の予定の一覧" },
] as const;

export type AutomationVariableKey = (typeof AUTOMATION_VARIABLES)[number]["key"];

const templateText = (max: number) => z.string().trim().min(1).max(max);

export const automationActionSchema = z.discriminatedUnion("type", [
  /** 通知を送る */
  z.object({
    type: z.literal("push"),
    title: templateText(100),
    body: z.string().max(500).default(""),
  }),
  /** アラームを鳴らす */
  z.object({
    type: z.literal("alarm"),
    title: templateText(100),
  }),
  /** 通知を送り、タップで URL を開く(会議に参加するなど) */
  z.object({
    type: z.literal("open_url"),
    title: templateText(100),
    /** 既定は会議 URL */
    url: z.string().max(1000).default("{{meeting_url}}"),
  }),
  /** 登録した API を呼ぶ */
  z.object({
    type: z.literal("webhook"),
    connection_id: z.uuid(),
    /** 送る JSON に足す任意のメモ */
    note: z.string().max(1000).optional(),
  }),
  /** AI に実行させる */
  z.object({
    type: z.literal("ai_task"),
    /** null は Slotto の内蔵 AI。値があるときはユーザーが登録した接続先 */
    connection_id: z.uuid().nullable().default(null),
    prompt: templateText(4000),
    /** 結果の届け方。push は通知 + 履歴、history は履歴だけ */
    deliver: z.enum(["push", "history"]).default("push"),
  }),
]);

export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationActionType = AutomationAction["type"];

export const AUTOMATION_ACTION_LABELS: Record<AutomationActionType, string> = {
  push: "通知を送る",
  alarm: "アラームを鳴らす",
  open_url: "会議や URL を開く",
  webhook: "API を呼ぶ",
  ai_task: "AI に実行させる",
};

export const automationActionsSchema = z.array(automationActionSchema).min(1).max(5);

/** オートメーションの作成・更新の入力。キーは automations の列名と同じ */
export const automationInputSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(60),
  description: z.string().max(300).nullable().default(null),
  is_enabled: z.boolean().default(true),
  trigger: automationTriggerSchema,
  target: automationTargetSchema.default({ scope: "all" }),
  actions: automationActionsSchema,
});

export type AutomationInput = z.infer<typeof automationInputSchema>;

/** 実行履歴に残る、アクション 1 つ分の結果(automation_runs.results の要素) */
export const automationActionResultSchema = z.object({
  type: z.enum(["push", "alarm", "open_url", "webhook", "ai_task"]),
  status: z.enum(["success", "failed", "skipped"]),
  /** 人が読む要約(AI の出力、Webhook の応答コードなど) */
  summary: z.string().optional(),
  /** AI の出力の全文 */
  output: z.string().optional(),
  error: z.string().optional(),
  duration_ms: z.number().optional(),
});

export type AutomationActionResult = z.infer<typeof automationActionResultSchema>;

/** 接続先の、秘密でない設定(api_connections.config) */
export const apiConnectionConfigSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("webhook"),
    url: z.url("URL の形式が正しくありません").max(1000),
    method: z.enum(["POST", "PUT"]).default("POST"),
  }),
  z.object({
    kind: z.literal("ai"),
    provider: z.enum(["anthropic", "openai"]),
    model: z.string().min(1).max(100),
  }),
]);

export type ApiConnectionConfig = z.infer<typeof apiConnectionConfigSchema>;

/**
 * 接続先の登録の入力(POST /api/connections)。
 * secret は、webhook では署名用の秘密の値(省略可)、ai では API キー。
 */
export const apiConnectionInputSchema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(60),
  config: apiConnectionConfigSchema,
  secret: z.string().max(500).optional(),
});

export type ApiConnectionInput = z.infer<typeof apiConnectionInputSchema>;

/** すぐ使えるテンプレート */
export const AUTOMATION_TEMPLATES: ReadonlyArray<{
  id: string;
  name: string;
  description: string;
  input: AutomationInput;
}> = [
  {
    id: "remind-10min",
    name: "10 分前に知らせる",
    description: "予定の 10 分前に通知を送ります。",
    input: {
      name: "10 分前に知らせる",
      description: null,
      is_enabled: true,
      trigger: { type: "before_start", offset_minutes: 10 },
      target: { scope: "all" },
      actions: [{ type: "push", title: "まもなく: {{title}}", body: "{{start}} から" }],
    },
  },
  {
    id: "join-meeting",
    name: "開始時刻に会議を開く",
    description: "開始時刻に通知を送り、タップで会議 URL を開きます。",
    input: {
      name: "開始時刻に会議を開く",
      description: null,
      is_enabled: true,
      trigger: { type: "at_start" },
      target: { scope: "bookings" },
      actions: [{ type: "open_url", title: "{{title}} が始まります", url: "{{meeting_url}}" }],
    },
  },
  {
    id: "ai-prep",
    name: "AI に準備メモを作らせる",
    description: "予約の 30 分前に、相手の回答内容から準備メモを作って届けます。",
    input: {
      name: "AI に準備メモを作らせる",
      description: null,
      is_enabled: true,
      trigger: { type: "before_start", offset_minutes: 30 },
      target: { scope: "bookings" },
      actions: [
        {
          type: "ai_task",
          connection_id: null,
          prompt:
            "次の予定の準備メモを、箇条書き 5 行以内で作ってください。\n予定: {{title}}\n相手: {{guest_name}}\n回答: {{answers}}",
          deliver: "push",
        },
      ],
    },
  },
  {
    id: "morning-brief",
    name: "毎朝、今日の予定をまとめる",
    description: "平日の朝 8 時に、AI が今日の予定を要約して届けます。",
    input: {
      name: "毎朝、今日の予定をまとめる",
      description: null,
      is_enabled: true,
      trigger: { type: "daily", time: "08:00", weekdays: [1, 2, 3, 4, 5] },
      target: { scope: "all" },
      actions: [
        {
          type: "ai_task",
          connection_id: null,
          prompt: "今日の予定を 3 行で要約し、気をつける点を 1 つ挙げてください。\n{{agenda}}",
          deliver: "push",
        },
      ],
    },
  },
];
