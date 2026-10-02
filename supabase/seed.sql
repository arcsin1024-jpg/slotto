-- ローカル開発用のデモデータ。`supabase db reset` で入る。
-- ログイン: demo@slotto.test / slotto-demo-password(Web のログイン画面の「開発用」ボタン)

do $$
declare
  demo_id uuid := '00000000-0000-4000-8000-000000000001';
  conn_id uuid := '00000000-0000-4000-8000-0000000000c1';
  cal_work uuid := '00000000-0000-4000-8000-0000000000a1';
  cal_private uuid := '00000000-0000-4000-8000-0000000000a2';
  page_id uuid := '00000000-0000-4000-8000-0000000000b1';
  today date := (now() at time zone 'Asia/Tokyo')::date;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000', demo_id, 'authenticated', 'authenticated',
    'demo@slotto.test', extensions.crypt('slotto-demo-password', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{"full_name": "山田 花子"}', now(), now(),
    '', '', '', ''
  );

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), demo_id, demo_id::text,
    jsonb_build_object('sub', demo_id::text, 'email', 'demo@slotto.test', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- profiles と user_settings はトリガーで作られる
  update public.profiles
  set username = 'hanako', bio = '株式会社サンプルで営業を担当しています。', onboarded_at = now()
  where id = demo_id;

  -- 外部カレンダー(Google を接続した想定。トークンは無いので同期はできない)
  insert into public.calendar_connections (id, user_id, provider, account_email, display_name, status, last_synced_at)
  values (conn_id, demo_id, 'google', 'hanako@example.com', '山田 花子', 'active', now());

  insert into public.external_calendars (id, connection_id, user_id, provider_calendar_id, name, color, is_primary, can_write)
  values
    (cal_work, conn_id, demo_id, 'hanako@example.com', '仕事', '#2F6BFF', true, true),
    (cal_private, conn_id, demo_id, 'private@group.calendar.google.com', 'プライベート', '#1F9D62', false, false);

  -- 外部予定: 一部だけ選択済み(反映中)、残りは未選択の新着
  insert into public.external_events (user_id, calendar_id, provider_event_id, series_id, title, location, starts_at, ends_at, is_selected, selected_at, selected_by)
  values
    (demo_id, cal_work, 'ev-weekly-1', 'series-weekly', '週次定例', '会議室 A',
      (today + 1 + time '10:00') at time zone 'Asia/Tokyo', (today + 1 + time '11:00') at time zone 'Asia/Tokyo', true, now(), 'series'),
    (demo_id, cal_work, 'ev-weekly-2', 'series-weekly', '週次定例', '会議室 A',
      (today + 8 + time '10:00') at time zone 'Asia/Tokyo', (today + 8 + time '11:00') at time zone 'Asia/Tokyo', true, now(), 'series'),
    (demo_id, cal_work, 'ev-client', null, '株式会社ミライ 打ち合わせ', 'オンライン',
      (today + 2 + time '14:00') at time zone 'Asia/Tokyo', (today + 2 + time '15:00') at time zone 'Asia/Tokyo', true, now(), 'manual'),
    (demo_id, cal_work, 'ev-lunch', null, 'ランチ(移動あり)', null,
      (today + 1 + time '12:00') at time zone 'Asia/Tokyo', (today + 1 + time '13:00') at time zone 'Asia/Tokyo', false, null, null),
    (demo_id, cal_work, 'ev-focus', null, '資料作成(集中)', null,
      (today + 3 + time '13:00') at time zone 'Asia/Tokyo', (today + 3 + time '16:00') at time zone 'Asia/Tokyo', false, null, null),
    (demo_id, cal_private, 'ev-dentist', null, '歯医者', '渋谷',
      (today + 4 + time '17:00') at time zone 'Asia/Tokyo', (today + 4 + time '18:00') at time zone 'Asia/Tokyo', false, null, null);

  insert into public.external_series_selections (calendar_id, series_id, user_id)
  values (cal_work, 'series-weekly', demo_id);

  -- 予約ページ
  insert into public.booking_pages (id, owner_id, slug, title, description, color, duration_minutes, availability, write_calendar_id, form_fields)
  values (
    page_id, demo_id, 'meeting', '30 分のオンライン相談',
    'サービスのご相談やデモをご希望の方はこちらからどうぞ。',
    'blue', 30,
    '{"weekly": {"0": [], "1": [{"start": "10:00", "end": "18:00"}], "2": [{"start": "10:00", "end": "18:00"}], "3": [{"start": "10:00", "end": "18:00"}], "4": [{"start": "10:00", "end": "18:00"}], "5": [{"start": "10:00", "end": "16:00"}], "6": []}, "overrides": []}',
    cal_work,
    '[{"id": "company", "type": "text", "label": "会社名", "required": true}, {"id": "topic", "type": "textarea", "label": "ご相談内容", "required": false}]'
  );

  insert into public.booking_pages (owner_id, slug, title, description, color, duration_minutes, confirmation_mode, location_type)
  values (demo_id, 'interview', '採用面談(60 分)', '面談の日時をお選びください。ホストの承認後に確定します。', 'green', 60, 'approval', 'in_person');

  -- 予約
  insert into public.bookings (booking_page_id, host_id, title, status, starts_at, ends_at, guest_name, guest_email, answers, location_type, meeting_url)
  values
    (page_id, demo_id, '30 分のオンライン相談', 'confirmed',
      (today + 1 + time '15:00') at time zone 'Asia/Tokyo', (today + 1 + time '15:30') at time zone 'Asia/Tokyo',
      '佐藤 健', 'sato@example.com', '{"company": "株式会社ミライ", "topic": "導入の流れを知りたい"}', 'google_meet', 'https://meet.google.com/abc-defg-hij'),
    (page_id, demo_id, '30 分のオンライン相談', 'pending',
      (today + 3 + time '11:00') at time zone 'Asia/Tokyo', (today + 3 + time '11:30') at time zone 'Asia/Tokyo',
      '鈴木 さくら', 'suzuki@example.com', '{"company": "合同会社ハル"}', 'google_meet', null);
end $$;
