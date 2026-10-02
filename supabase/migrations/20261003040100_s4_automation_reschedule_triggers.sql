-- オートメーションと反映中の外部予定が変わったら、ジョブの入れ直しを予約する(担当: S4)
--
-- アプリは automations と external_events(選択の状態)を Supabase で直接書き換えるので、
-- サーバーの関数を通らない変更もある。ここで拾い、次の dispatch で入れ直す
-- (apps/web/src/server/jobs の rescheduleUserAutomations)。
-- 外部予定の変化では、アプリにローカル通知を張り直させる同期のプッシュも予約する。
-- 同じユーザーの変更が続いても、ジョブは dedupe_key で 1 件にまとまる。

create or replace function public.enqueue_automation_reschedule(p_user_id uuid, p_sync boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- ユーザーの削除で連鎖して消えている途中なら何もしない(外部キーに当たるため)
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id) then
    return;
  end if;

  insert into public.scheduled_jobs (user_id, kind, run_at, payload, dedupe_key, max_attempts)
  values (p_user_id, 'automation_run', now(), '{"mode": "reschedule"}', 'user:' || p_user_id || ':automations:reschedule', 3)
  on conflict (dedupe_key) do update
    set status = 'pending',
        run_at = case when public.scheduled_jobs.status = 'pending'
                      then least(public.scheduled_jobs.run_at, excluded.run_at)
                      else excluded.run_at end,
        payload = excluded.payload,
        attempts = 0,
        max_attempts = excluded.max_attempts,
        last_error = null,
        locked_at = null,
        finished_at = null;

  if p_sync then
    insert into public.scheduled_jobs (user_id, kind, run_at, payload, dedupe_key, max_attempts)
    values (p_user_id, 'push_notification', now(), '{"sync": true, "reason": "external_events"}', 'user:' || p_user_id || ':sync', 3)
    on conflict (dedupe_key) do update
      set status = 'pending',
          run_at = case when public.scheduled_jobs.status = 'pending'
                        then least(public.scheduled_jobs.run_at, excluded.run_at)
                        else excluded.run_at end,
          payload = excluded.payload,
          attempts = 0,
          max_attempts = excluded.max_attempts,
          last_error = null,
          locked_at = null,
          finished_at = null;
  end if;
end;
$$;

revoke execute on function public.enqueue_automation_reschedule(uuid, boolean) from public, anon, authenticated;

-- automations ---------------------------------------------------------------

create or replace function public.on_automations_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_automation_reschedule(old.user_id, false);
  else
    perform public.enqueue_automation_reschedule(new.user_id, false);
  end if;
  return null;
end;
$$;

revoke execute on function public.on_automations_changed() from public, anon, authenticated;

create trigger automations_reschedule_on_insert
  after insert on public.automations
  for each row execute function public.on_automations_changed();

create trigger automations_reschedule_on_update
  after update on public.automations
  for each row
  when (
    old.is_enabled is distinct from new.is_enabled
    or old.trigger is distinct from new.trigger
    or old.target is distinct from new.target
  )
  execute function public.on_automations_changed();

create trigger automations_reschedule_on_delete
  after delete on public.automations
  for each row execute function public.on_automations_changed();

-- external_events(反映中の予定だけ) -----------------------------------------

create or replace function public.on_selected_events_changed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.enqueue_automation_reschedule(old.user_id, true);
  else
    perform public.enqueue_automation_reschedule(new.user_id, true);
  end if;
  return null;
end;
$$;

revoke execute on function public.on_selected_events_changed() from public, anon, authenticated;

create trigger external_events_reschedule_on_insert
  after insert on public.external_events
  for each row
  when (new.is_selected)
  execute function public.on_selected_events_changed();

create trigger external_events_reschedule_on_update
  after update on public.external_events
  for each row
  when (
    (old.is_selected or new.is_selected)
    and (
      old.is_selected is distinct from new.is_selected
      or old.starts_at is distinct from new.starts_at
      or old.ends_at is distinct from new.ends_at
      or old.is_all_day is distinct from new.is_all_day
      or old.title is distinct from new.title
    )
  )
  execute function public.on_selected_events_changed();

create trigger external_events_reschedule_on_delete
  after delete on public.external_events
  for each row
  when (old.is_selected)
  execute function public.on_selected_events_changed();
