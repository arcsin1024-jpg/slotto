/**
 * Supabase の DB の型。supabase/migrations の定義と対応させる。
 *
 * いまは手書き。ローカルの Supabase が動いたら、次のコマンドの出力で置き換える:
 *   supabase gen types typescript --local > packages/core/src/database.ts
 * 置き換えるまでは、マイグレーションを足した担当がここも更新する。
 * 外部キーの関係(Relationships)は書いていないので、select での埋め込み(join)は型が付かない。
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Timestamp = string;

/** Row のうち、K のキーを省略できるようにしたもの(既定値のある列) */
type WithDefaults<Row, K extends keyof Row> = Omit<Row, K> & Partial<Pick<Row, K>>;

type Table<Row, Insert> = {
  Row: Row;
  Insert: Insert;
  Update: Partial<Row>;
  Relationships: [];
};

export type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  timezone: string;
  locale: string;
  plan: "free" | "pro";
  onboarded_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type UserSettingsRow = {
  user_id: string;
  notify_minutes: number[];
  alarm_minutes: number[];
  alarm_sound: string;
  notify_selected_events: boolean;
  email_on_booking: boolean;
  email_on_cancel: boolean;
  updated_at: Timestamp;
};

export type CalendarConnectionRow = {
  id: string;
  user_id: string;
  provider: "google" | "microsoft" | "device";
  account_email: string;
  display_name: string | null;
  status: "active" | "needs_reauth" | "revoked";
  scopes: string[];
  last_synced_at: Timestamp | null;
  last_error: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type CalendarTokenRow = {
  connection_id: string;
  access_token_enc: string | null;
  refresh_token_enc: string | null;
  expires_at: Timestamp | null;
  updated_at: Timestamp;
};

export type ExternalCalendarRow = {
  id: string;
  connection_id: string;
  user_id: string;
  provider_calendar_id: string;
  name: string;
  color: string | null;
  is_primary: boolean;
  can_write: boolean;
  is_enabled: boolean;
  auto_select_new: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ExternalCalendarSyncRow = {
  calendar_id: string;
  sync_token: string | null;
  watch_channel_id: string | null;
  watch_resource_id: string | null;
  watch_token: string | null;
  watch_expires_at: Timestamp | null;
  last_synced_at: Timestamp | null;
  last_error: string | null;
};

export type ExternalEventRow = {
  id: string;
  user_id: string;
  calendar_id: string;
  provider_event_id: string;
  series_id: string | null;
  title: string;
  location: string | null;
  starts_at: Timestamp;
  ends_at: Timestamp;
  is_all_day: boolean;
  status: "confirmed" | "tentative";
  is_busy: boolean;
  is_selected: boolean;
  selected_at: Timestamp | null;
  selected_by: "manual" | "series" | "auto" | null;
  seen_at: Timestamp | null;
  html_link: string | null;
  provider_updated_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ExternalSeriesSelectionRow = {
  calendar_id: string;
  series_id: string;
  user_id: string;
  created_at: Timestamp;
};

export type BookingPageRow = {
  id: string;
  owner_id: string;
  slug: string;
  title: string;
  description: string | null;
  color: string;
  kind: "recurring" | "one_time";
  slot_mode: "availability" | "candidates";
  duration_minutes: number;
  slot_interval_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
  max_bookings_per_day: number | null;
  timezone: string;
  /** packages/core の Availability */
  availability: Json;
  exclude_holidays: boolean;
  location_type: "google_meet" | "zoom" | "teams" | "in_person" | "phone" | "custom_url" | "none";
  location_value: string | null;
  confirmation_mode: "instant" | "approval";
  /** packages/core の FormField[] */
  form_fields: Json;
  reminder_minutes: number[];
  allow_guest_cancel: boolean;
  allow_guest_reschedule: boolean;
  guest_change_deadline_minutes: number;
  write_calendar_id: string | null;
  completion_message: string | null;
  is_active: boolean;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type BookingPageCandidateRow = {
  id: string;
  booking_page_id: string;
  starts_at: Timestamp;
  ends_at: Timestamp;
};

export type BookingRow = {
  id: string;
  booking_page_id: string | null;
  host_id: string;
  title: string;
  status: "pending" | "confirmed" | "cancelled" | "declined";
  starts_at: Timestamp;
  ends_at: Timestamp;
  guest_name: string;
  guest_email: string;
  guest_timezone: string;
  /** packages/core の BookingAnswers */
  answers: Json;
  location_type: string;
  location_value: string | null;
  meeting_url: string | null;
  manage_token: string;
  rescheduled_from: string | null;
  cancelled_at: Timestamp | null;
  cancelled_by: "host" | "guest" | null;
  cancel_reason: string | null;
  provider_event_id: string | null;
  provider_calendar_id: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type BookingEventRow = {
  id: string;
  booking_id: string;
  type:
    | "created"
    | "approved"
    | "declined"
    | "rescheduled"
    | "cancelled"
    | "reminder_sent"
    | "calendar_written"
    | "email_sent"
    | "failed";
  actor: "host" | "guest" | "system";
  data: Json;
  created_at: Timestamp;
};

export type ScheduledJobKind =
  | "reminder_email"
  | "push_notification"
  | "automation_run"
  | "calendar_sync"
  | "calendar_watch_renew";

export type ScheduledJobRow = {
  id: string;
  user_id: string | null;
  kind: ScheduledJobKind;
  run_at: Timestamp;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  attempts: number;
  max_attempts: number;
  payload: Json;
  dedupe_key: string | null;
  last_error: string | null;
  locked_at: Timestamp | null;
  finished_at: Timestamp | null;
  created_at: Timestamp;
};

export type EventAlarmRow = {
  id: string;
  user_id: string;
  source_type: "booking" | "external_event";
  source_id: string;
  notify_minutes: number[];
  alarm_minutes: number[];
  is_muted: boolean;
  updated_at: Timestamp;
};

export type PushDeviceRow = {
  id: string;
  user_id: string;
  expo_push_token: string;
  platform: "ios" | "android";
  device_name: string | null;
  app_version: string | null;
  last_seen_at: Timestamp;
  created_at: Timestamp;
};

export type ApiConnectionRow = {
  id: string;
  user_id: string;
  kind: "webhook" | "ai";
  name: string;
  /** packages/core の ApiConnectionConfig */
  config: Json;
  has_secret: boolean;
  last_used_at: Timestamp | null;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type ApiConnectionSecretRow = {
  connection_id: string;
  secret_enc: string;
  updated_at: Timestamp;
};

export type AutomationRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_enabled: boolean;
  /** packages/core の AutomationTrigger */
  trigger: Json;
  /** packages/core の AutomationTarget */
  target: Json;
  /** packages/core の AutomationAction[] */
  actions: Json;
  created_at: Timestamp;
  updated_at: Timestamp;
};

export type AutomationRunRow = {
  id: string;
  automation_id: string;
  user_id: string;
  source_type: "booking" | "external_event" | "schedule" | "manual";
  source_id: string | null;
  scheduled_for: Timestamp;
  started_at: Timestamp | null;
  finished_at: Timestamp | null;
  status: "pending" | "running" | "success" | "failed" | "skipped";
  /** packages/core の AutomationActionResult[] */
  results: Json;
  error: string | null;
  created_at: Timestamp;
};

type Audit = "created_at" | "updated_at";

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        ProfileRow,
        WithDefaults<
          ProfileRow,
          Audit | "username" | "display_name" | "avatar_url" | "bio" | "timezone" | "locale" | "plan" | "onboarded_at"
        >
      >;
      user_settings: Table<UserSettingsRow, WithDefaults<UserSettingsRow, Exclude<keyof UserSettingsRow, "user_id">>>;
      calendar_connections: Table<
        CalendarConnectionRow,
        WithDefaults<
          CalendarConnectionRow,
          Audit | "id" | "account_email" | "display_name" | "status" | "scopes" | "last_synced_at" | "last_error"
        >
      >;
      calendar_tokens: Table<
        CalendarTokenRow,
        WithDefaults<CalendarTokenRow, "access_token_enc" | "refresh_token_enc" | "expires_at" | "updated_at">
      >;
      external_calendars: Table<
        ExternalCalendarRow,
        WithDefaults<ExternalCalendarRow, Audit | "id" | "color" | "is_primary" | "can_write" | "is_enabled" | "auto_select_new">
      >;
      external_calendar_sync: Table<
        ExternalCalendarSyncRow,
        WithDefaults<ExternalCalendarSyncRow, Exclude<keyof ExternalCalendarSyncRow, "calendar_id">>
      >;
      external_events: Table<
        ExternalEventRow,
        WithDefaults<
          ExternalEventRow,
          | Audit
          | "id"
          | "series_id"
          | "title"
          | "location"
          | "is_all_day"
          | "status"
          | "is_busy"
          | "is_selected"
          | "selected_at"
          | "selected_by"
          | "seen_at"
          | "html_link"
          | "provider_updated_at"
        >
      >;
      external_series_selections: Table<ExternalSeriesSelectionRow, WithDefaults<ExternalSeriesSelectionRow, "created_at">>;
      booking_pages: Table<
        BookingPageRow,
        WithDefaults<BookingPageRow, Exclude<keyof BookingPageRow, "owner_id" | "slug" | "title">>
      >;
      booking_page_candidates: Table<BookingPageCandidateRow, WithDefaults<BookingPageCandidateRow, "id">>;
      bookings: Table<
        BookingRow,
        WithDefaults<
          BookingRow,
          | Audit
          | "id"
          | "booking_page_id"
          | "status"
          | "guest_timezone"
          | "answers"
          | "location_type"
          | "location_value"
          | "meeting_url"
          | "manage_token"
          | "rescheduled_from"
          | "cancelled_at"
          | "cancelled_by"
          | "cancel_reason"
          | "provider_event_id"
          | "provider_calendar_id"
        >
      >;
      booking_events: Table<BookingEventRow, WithDefaults<BookingEventRow, "id" | "data" | "created_at">>;
      scheduled_jobs: Table<
        ScheduledJobRow,
        WithDefaults<ScheduledJobRow, Exclude<keyof ScheduledJobRow, "kind" | "run_at">>
      >;
      event_alarms: Table<
        EventAlarmRow,
        WithDefaults<EventAlarmRow, "id" | "notify_minutes" | "alarm_minutes" | "is_muted" | "updated_at">
      >;
      push_devices: Table<
        PushDeviceRow,
        WithDefaults<PushDeviceRow, "id" | "device_name" | "app_version" | "last_seen_at" | "created_at">
      >;
      api_connections: Table<
        ApiConnectionRow,
        WithDefaults<ApiConnectionRow, Audit | "id" | "config" | "has_secret" | "last_used_at">
      >;
      api_connection_secrets: Table<ApiConnectionSecretRow, WithDefaults<ApiConnectionSecretRow, "updated_at">>;
      automations: Table<
        AutomationRow,
        WithDefaults<AutomationRow, Audit | "id" | "description" | "is_enabled" | "target" | "actions">
      >;
      automation_runs: Table<
        AutomationRunRow,
        WithDefaults<
          AutomationRunRow,
          "id" | "source_id" | "started_at" | "finished_at" | "status" | "results" | "error" | "created_at"
        >
      >;
    };
    Views: { [_ in never]: never };
    Functions: {
      claim_due_jobs: {
        Args: { p_limit?: number };
        Returns: ScheduledJobRow[];
      };
      create_booking: {
        Args: {
          p_page_id: string;
          p_starts_at: string;
          p_ends_at: string;
          p_guest_name: string;
          p_guest_email: string;
          p_guest_timezone: string;
          p_answers: Json;
          p_rescheduled_from?: string | null;
        };
        Returns: BookingRow;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database["public"]["Tables"];
export type Tables<T extends TableName> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends TableName> = Database["public"]["Tables"][T]["Update"];
