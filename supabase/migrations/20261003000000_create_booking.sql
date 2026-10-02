-- 予約の確定を 1 つのトランザクションにまとめる(担当: S2 ゲスト予約)
-- 設計: docs/design.md の 7.2、docs/research/tech.md の 7 章
--
-- 空き枠の計算(受付時間、祝日、受付期限)はサーバーの TypeScript(packages/core の computeSlots)で行う。
-- この関数は、ホストごとのロックを取ったうえで、時間の重なりと 1 日の上限だけを確かめ直してから書き込む。
-- 排他制約(bookings_no_overlap)だけでは、前後の空き・反映中の外部予定・1 日の上限は守れないため。

-- 予約の履歴に、メールの送信と後処理の失敗を記録できるようにする
alter table public.booking_events drop constraint booking_events_type_check;
alter table public.booking_events add constraint booking_events_type_check check (type in (
  'created', 'approved', 'declined', 'rescheduled', 'cancelled', 'reminder_sent', 'calendar_written',
  'email_sent', 'failed'
));

-- 予約を作る。p_rescheduled_from を渡すと日程変更として扱い、元の予約を取り消してから新しい予約を作る。
-- 失敗したときの例外のメッセージ:
--   page_not_found  予約ページが無い
--   page_inactive   予約ページが公開されていない
--   invalid_reschedule  元の予約が変更できる状態ではない
--   slot_taken      その時間はふさがっている(排他制約に当たった場合も含む)
create or replace function public.create_booking(
  p_page_id uuid,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_guest_name text,
  p_guest_email text,
  p_guest_timezone text,
  p_answers jsonb,
  p_rescheduled_from uuid default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_page public.booking_pages;
  v_old public.bookings;
  v_booking public.bookings;
  v_before interval;
  v_after interval;
  v_count integer;
begin
  select * into v_page from public.booking_pages where id = p_page_id;
  if not found then
    raise exception 'page_not_found';
  end if;

  -- 同じホストの予約の処理を 1 件ずつにする
  perform pg_advisory_xact_lock(hashtextextended(v_page.owner_id::text, 0));

  if p_rescheduled_from is not null then
    select * into v_old from public.bookings where id = p_rescheduled_from for update;
    if not found or v_old.host_id <> v_page.owner_id or v_old.status not in ('pending', 'confirmed') then
      raise exception 'invalid_reschedule';
    end if;
    -- 元の予約を先に取り消す(新しい時間が元の時間と重なってもよいように)。
    -- 後で失敗したらトランザクションごと元に戻る
    update public.bookings
    set status = 'cancelled', cancelled_at = now(), cancelled_by = 'guest'
    where id = v_old.id;
  elsif not v_page.is_active then
    raise exception 'page_inactive';
  end if;

  v_before := make_interval(mins => v_page.buffer_before_minutes);
  v_after := make_interval(mins => v_page.buffer_after_minutes);

  -- 前後の空きを足した範囲が、有効な予約とも反映中の外部予定とも重ならないこと
  if exists (
    select 1 from public.bookings b
    where b.host_id = v_page.owner_id
      and b.status in ('pending', 'confirmed')
      and b.starts_at < p_ends_at + v_after
      and b.ends_at > p_starts_at - v_before
  ) or exists (
    select 1 from public.external_events e
    where e.user_id = v_page.owner_id
      and e.is_selected
      and e.ends_at > e.starts_at
      and e.starts_at < p_ends_at + v_after
      and e.ends_at > p_starts_at - v_before
  ) then
    raise exception 'slot_taken';
  end if;

  -- 1 日の上限(この予約ページの予約を、予約ページのタイムゾーンの日付で数える)
  if v_page.max_bookings_per_day is not null then
    select count(*) into v_count
    from public.bookings b
    where b.booking_page_id = v_page.id
      and b.status in ('pending', 'confirmed')
      and (b.starts_at at time zone v_page.timezone)::date = (p_starts_at at time zone v_page.timezone)::date;
    if v_count >= v_page.max_bookings_per_day then
      raise exception 'slot_taken';
    end if;
  end if;

  begin
    insert into public.bookings (
      booking_page_id, host_id, title, status, starts_at, ends_at,
      guest_name, guest_email, guest_timezone, answers,
      location_type, location_value, rescheduled_from
    ) values (
      v_page.id, v_page.owner_id, v_page.title,
      case when v_page.confirmation_mode = 'approval' then 'pending' else 'confirmed' end,
      p_starts_at, p_ends_at,
      p_guest_name, p_guest_email, p_guest_timezone, coalesce(p_answers, '{}'::jsonb),
      v_page.location_type, v_page.location_value, p_rescheduled_from
    )
    returning * into v_booking;
  exception when exclusion_violation then
    raise exception 'slot_taken';
  end;

  -- 1 回限りの予約ページは、予約が入ったら閉じる
  if v_page.kind = 'one_time' and v_page.is_active then
    update public.booking_pages set is_active = false where id = v_page.id;
  end if;

  insert into public.booking_events (booking_id, type, actor, data)
  values (
    v_booking.id, 'created', 'guest',
    jsonb_build_object('status', v_booking.status, 'rescheduled_from', p_rescheduled_from)
  );

  if p_rescheduled_from is not null then
    insert into public.booking_events (booking_id, type, actor, data)
    values (
      p_rescheduled_from, 'rescheduled', 'guest',
      jsonb_build_object('to', v_booking.id, 'starts_at', p_starts_at, 'ends_at', p_ends_at)
    );
  end if;

  return v_booking;
end;
$$;

revoke execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.create_booking(uuid, timestamptz, timestamptz, text, text, text, jsonb, uuid)
  to service_role;
