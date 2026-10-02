-- Slotto 初期スキーマ
-- 設計: docs/design.md の「6. データモデル」

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 共通
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- ユーザー
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- 予約ページの URL になる。初回設定で決めるまでは null
  username text unique check (username ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  display_name text not null default '',
  avatar_url text,
  bio text,
  timezone text not null default 'Asia/Tokyo',
  locale text not null default 'ja',
  plan text not null default 'free' check (plan in ('free', 'pro')),
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  -- 通知・アラームの初期値(開始の何分前か)。アプリ限定機能
  notify_minutes integer[] not null default '{10}',
  alarm_minutes integer[] not null default '{}',
  alarm_sound text not null default 'default',
  notify_selected_events boolean not null default true,
  -- メール通知
  email_on_booking boolean not null default true,
  email_on_cancel boolean not null default true,
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 外部カレンダー連携と「選んだ予定だけ反映」
-- ---------------------------------------------------------------------------

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- device: アプリが端末のカレンダーから送ってきた予定
  provider text not null check (provider in ('google', 'microsoft', 'device')),
  account_email text not null default '',
  display_name text,
  status text not null default 'active' check (status in ('active', 'needs_reauth', 'revoked')),
  scopes text[] not null default '{}',
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, account_email)
);

-- サーバーだけが読む。値はアプリ側で暗号化してから入れる
create table public.calendar_tokens (
  connection_id uuid primary key references public.calendar_connections (id) on delete cascade,
  access_token_enc text,
  refresh_token_enc text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.external_calendars (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.calendar_connections (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provider_calendar_id text not null,
  name text not null,
  color text,
  is_primary boolean not null default false,
  can_write boolean not null default false,
  -- 取り込み画面に出すか(同期するか)
  is_enabled boolean not null default true,
  -- 新しく増えた予定を自動で反映するか
  auto_select_new boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, provider_calendar_id)
);

-- 同期の状態。サーバーだけが読む
create table public.external_calendar_sync (
  calendar_id uuid primary key references public.external_calendars (id) on delete cascade,
  sync_token text,
  watch_channel_id text,
  watch_resource_id text,
  watch_token text,
  watch_expires_at timestamptz,
  last_synced_at timestamptz,
  last_error text
);

create table public.external_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  calendar_id uuid not null references public.external_calendars (id) on delete cascade,
  provider_event_id text not null,
  -- 繰り返し予定の親 ID(単発の予定は null)
  series_id text,
  title text not null default '',
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_all_day boolean not null default false,
  status text not null default 'confirmed' check (status in ('confirmed', 'tentative')),
  -- 外部カレンダー側で「予定あり」になっているか
  is_busy boolean not null default true,
  -- 反映するか。true の予定だけが Slotto に表示され、空き時間の計算に使われる
  is_selected boolean not null default false,
  selected_at timestamptz,
  selected_by text check (selected_by in ('manual', 'series', 'auto')),
  -- 取り込み画面で見たか(「未選択の新着」の件数に使う)
  seen_at timestamptz,
  html_link text,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (calendar_id, provider_event_id),
  check (ends_at >= starts_at)
);

create index external_events_user_starts_idx on public.external_events (user_id, starts_at);
create index external_events_user_selected_idx on public.external_events (user_id, starts_at) where is_selected;
create index external_events_series_idx on public.external_events (calendar_id, series_id) where series_id is not null;

-- 「この繰り返しは今後すべて反映」
create table public.external_series_selections (
  calendar_id uuid not null references public.external_calendars (id) on delete cascade,
  series_id text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (calendar_id, series_id)
);

-- ---------------------------------------------------------------------------
-- 予約ページ
-- ---------------------------------------------------------------------------

create table public.booking_pages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9_-]{0,49}$'),
  title text not null,
  description text,
  color text not null default 'blue',
  -- recurring: 繰り返し使う / one_time: 1 件予約が入ると閉じる
  kind text not null default 'recurring' check (kind in ('recurring', 'one_time')),
  -- availability: 空き時間から自動で出す / candidates: ホストが候補を手で選ぶ
  slot_mode text not null default 'availability' check (slot_mode in ('availability', 'candidates')),
  duration_minutes integer not null default 30 check (duration_minutes between 5 and 720),
  slot_interval_minutes integer not null default 30 check (slot_interval_minutes between 5 and 720),
  buffer_before_minutes integer not null default 0 check (buffer_before_minutes between 0 and 240),
  buffer_after_minutes integer not null default 0 check (buffer_after_minutes between 0 and 240),
  -- 何分前まで受け付けるか / 何日先まで受け付けるか
  min_notice_minutes integer not null default 180 check (min_notice_minutes >= 0),
  max_days_ahead integer not null default 30 check (max_days_ahead between 1 and 365),
  max_bookings_per_day integer check (max_bookings_per_day > 0),
  timezone text not null default 'Asia/Tokyo',
  -- 受付時間。形は packages/core の availabilitySchema
  availability jsonb not null default '{"weekly": {}, "overrides": []}',
  exclude_holidays boolean not null default true,
  location_type text not null default 'google_meet'
    check (location_type in ('google_meet', 'zoom', 'teams', 'in_person', 'phone', 'custom_url', 'none')),
  location_value text,
  -- instant: 即時確定 / approval: ホストの承認で確定
  confirmation_mode text not null default 'instant' check (confirmation_mode in ('instant', 'approval')),
  -- 追加の質問。形は packages/core の formFieldsSchema
  form_fields jsonb not null default '[]',
  -- ゲストとホストへのメールリマインド(開始の何分前か)
  reminder_minutes integer[] not null default '{1440}',
  allow_guest_cancel boolean not null default true,
  allow_guest_reschedule boolean not null default true,
  -- 変更・キャンセルを何分前まで許すか
  guest_change_deadline_minutes integer not null default 0 check (guest_change_deadline_minutes >= 0),
  -- 確定した予約を書き込む外部カレンダー
  write_calendar_id uuid references public.external_calendars (id) on delete set null,
  completion_message text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create table public.booking_page_candidates (
  id uuid primary key default gen_random_uuid(),
  booking_page_id uuid not null references public.booking_pages (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  check (ends_at > starts_at),
  unique (booking_page_id, starts_at)
);

-- ---------------------------------------------------------------------------
-- 予約
-- ---------------------------------------------------------------------------

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_page_id uuid references public.booking_pages (id) on delete set null,
  host_id uuid not null references public.profiles (id) on delete cascade,
  -- 予約時点のタイトル(予約ページが後で変わっても残す)
  title text not null,
  status text not null default 'confirmed' check (status in ('pending', 'confirmed', 'cancelled', 'declined')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  guest_name text not null,
  guest_email text not null,
  guest_timezone text not null default 'Asia/Tokyo',
  -- 追加の質問への回答。{ フィールド ID: 値 }
  answers jsonb not null default '{}',
  location_type text not null default 'none',
  location_value text,
  meeting_url text,
  -- ゲスト用の確認・変更・キャンセルリンクに使う
  manage_token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  rescheduled_from uuid references public.bookings (id) on delete set null,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('host', 'guest')),
  cancel_reason text,
  -- 外部カレンダーに書き込んだ予定
  provider_event_id text,
  provider_calendar_id uuid references public.external_calendars (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  -- 同じホストの有効な予約どうしは重ならない(二重予約の防止)
  constraint bookings_no_overlap exclude using gist (
    host_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('pending', 'confirmed'))
);

create index bookings_host_starts_idx on public.bookings (host_id, starts_at);
create index bookings_page_idx on public.bookings (booking_page_id);

create table public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  type text not null check (type in (
    'created', 'approved', 'declined', 'rescheduled', 'cancelled', 'reminder_sent', 'calendar_written'
  )),
  actor text not null check (actor in ('host', 'guest', 'system')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index booking_events_booking_idx on public.booking_events (booking_id, created_at);

-- ---------------------------------------------------------------------------
-- 時刻指定の実行
-- ---------------------------------------------------------------------------

create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete cascade,
  kind text not null check (kind in (
    'reminder_email', 'push_notification', 'automation_run', 'calendar_sync', 'calendar_watch_renew'
  )),
  run_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed', 'cancelled')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  payload jsonb not null default '{}',
  -- 同じジョブを二重に入れないためのキー。予約の変更時の取り消しにも使う
  dedupe_key text unique,
  last_error text,
  locked_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index scheduled_jobs_due_idx on public.scheduled_jobs (run_at) where status = 'pending';

-- 時刻が来たジョブをまとめて取り出す。同時に呼ばれても同じジョブは 1 回だけ渡す
create or replace function public.claim_due_jobs(p_limit integer default 50)
returns setof public.scheduled_jobs
language sql
security definer
set search_path = ''
as $$
  update public.scheduled_jobs j
  set status = 'running', locked_at = now(), attempts = j.attempts + 1
  where j.id in (
    select id
    from public.scheduled_jobs
    where status = 'pending' and run_at <= now()
    order by run_at
    limit p_limit
    for update skip locked
  )
  returning j.*;
$$;

revoke execute on function public.claim_due_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_jobs(integer) to service_role;

-- ---------------------------------------------------------------------------
-- アプリ限定: 通知・アラーム、オートメーション
-- ---------------------------------------------------------------------------

-- 予定ごとの通知・アラームの個別設定
create table public.event_alarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_type text not null check (source_type in ('booking', 'external_event')),
  source_id uuid not null,
  notify_minutes integer[] not null default '{}',
  alarm_minutes integer[] not null default '{}',
  is_muted boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, source_type, source_id)
);

create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  device_name text,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index push_devices_user_idx on public.push_devices (user_id);

-- オートメーションが呼ぶ外部 API や AI の設定
create table public.api_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('webhook', 'ai')),
  name text not null,
  -- 秘密でない設定。形は packages/core の apiConnectionConfigSchema
  config jsonb not null default '{}',
  has_secret boolean not null default false,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- サーバーだけが読む。値はアプリ側で暗号化してから入れる
create table public.api_connection_secrets (
  connection_id uuid primary key references public.api_connections (id) on delete cascade,
  secret_enc text not null,
  updated_at timestamptz not null default now()
);

create table public.automations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  is_enabled boolean not null default true,
  -- 形は packages/core の automationTriggerSchema / automationTargetSchema / automationActionsSchema
  trigger jsonb not null,
  target jsonb not null default '{"scope": "all"}',
  actions jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automations_user_idx on public.automations (user_id);

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_type text not null check (source_type in ('booking', 'external_event', 'schedule', 'manual')),
  source_id uuid,
  scheduled_for timestamptz not null,
  started_at timestamptz,
  finished_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'running', 'success', 'failed', 'skipped')),
  -- アクションごとの結果
  results jsonb not null default '[]',
  error text,
  created_at timestamptz not null default now()
);

create index automation_runs_user_idx on public.automation_runs (user_id, scheduled_for desc);
create index automation_runs_automation_idx on public.automation_runs (automation_id, scheduled_for desc);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.calendar_connections
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.calendar_tokens
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.external_calendars
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.external_events
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.booking_pages
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.event_alarms
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.api_connections
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.api_connection_secrets
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.automations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 行レベルセキュリティ
--
-- ログイン中のユーザーは自分の行だけ読める。匿名ユーザーには何も見せない。
-- ゲスト向けの画面と API、メール送信や外部連携を伴う書き込みは、
-- サーバー(service_role)が行う。
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.calendar_connections enable row level security;
alter table public.calendar_tokens enable row level security;
alter table public.external_calendars enable row level security;
alter table public.external_calendar_sync enable row level security;
alter table public.external_events enable row level security;
alter table public.external_series_selections enable row level security;
alter table public.booking_pages enable row level security;
alter table public.booking_page_candidates enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.scheduled_jobs enable row level security;
alter table public.event_alarms enable row level security;
alter table public.push_devices enable row level security;
alter table public.api_connections enable row level security;
alter table public.api_connection_secrets enable row level security;
alter table public.automations enable row level security;
alter table public.automation_runs enable row level security;

-- サーバー専用の表: ポリシーを作らず、権限も外す
revoke all on public.calendar_tokens from anon, authenticated;
revoke all on public.external_calendar_sync from anon, authenticated;
revoke all on public.api_connection_secrets from anon, authenticated;
revoke all on public.scheduled_jobs from anon, authenticated;

-- profiles: 読み取りと更新。plan はサーバーだけが変える
create policy "profiles: 自分の行を読む" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: 自分の行を更新する" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_url, bio, timezone, locale, onboarded_at)
  on public.profiles to authenticated;

create policy "user_settings: 自分の行" on public.user_settings
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 連携: 読み取りのみ。接続と解除はサーバーの API で行う
create policy "calendar_connections: 自分の行を読む" on public.calendar_connections
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.calendar_connections from anon, authenticated;

-- 外部カレンダー: 表示のオン・オフと自動反映だけ変えられる
create policy "external_calendars: 自分の行を読む" on public.external_calendars
  for select to authenticated using (user_id = (select auth.uid()));
create policy "external_calendars: 自分の行を更新する" on public.external_calendars
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.external_calendars from anon, authenticated;
grant update (is_enabled, auto_select_new) on public.external_calendars to authenticated;

-- 外部予定: 選択の状態だけ変えられる
create policy "external_events: 自分の行を読む" on public.external_events
  for select to authenticated using (user_id = (select auth.uid()));
create policy "external_events: 自分の行を更新する" on public.external_events
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke insert, update, delete on public.external_events from anon, authenticated;
grant update (is_selected, selected_at, selected_by, seen_at) on public.external_events to authenticated;

create policy "external_series_selections: 自分の行" on public.external_series_selections
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "booking_pages: 自分の行" on public.booking_pages
  for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy "booking_page_candidates: 自分の予約ページの行" on public.booking_page_candidates
  for all to authenticated
  using (exists (
    select 1 from public.booking_pages p
    where p.id = booking_page_id and p.owner_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.booking_pages p
    where p.id = booking_page_id and p.owner_id = (select auth.uid())
  ));

-- 予約: 読み取りのみ。作成・承認・キャンセルはサーバーの API で行う(メール送信などを伴うため)
create policy "bookings: 自分が受けた予約を読む" on public.bookings
  for select to authenticated using (host_id = (select auth.uid()));
revoke insert, update, delete on public.bookings from anon, authenticated;

create policy "booking_events: 自分が受けた予約の履歴を読む" on public.booking_events
  for select to authenticated
  using (exists (
    select 1 from public.bookings b
    where b.id = booking_id and b.host_id = (select auth.uid())
  ));
revoke insert, update, delete on public.booking_events from anon, authenticated;

create policy "event_alarms: 自分の行" on public.event_alarms
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "push_devices: 自分の行" on public.push_devices
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 接続先: 読み取りと削除。登録と更新は秘密の値を含むためサーバーの API で行う
create policy "api_connections: 自分の行を読む" on public.api_connections
  for select to authenticated using (user_id = (select auth.uid()));
create policy "api_connections: 自分の行を消す" on public.api_connections
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.api_connections from anon, authenticated;

create policy "automations: 自分の行" on public.automations
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "automation_runs: 自分の行を読む" on public.automation_runs
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.automation_runs from anon, authenticated;
