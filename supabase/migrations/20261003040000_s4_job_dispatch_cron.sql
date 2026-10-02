-- 時刻指定の実行: pg_cron が毎分、pg_net で Web の /api/internal/dispatch を呼ぶ(担当: S4)
-- 設計: docs/design.md の「7.4 時刻指定の実行」、docs/research/tech.md の 9 章
--
-- 呼び先の URL と共有シークレットは Vault に置き、環境ごとに変える(このファイルには書かない)。
-- 未登録のあいだは何もしない。登録の例(SQL エディタか psql で実行):
--
--   ローカル(Next.js をホストの 3004 番で起動している場合):
--     select vault.create_secret('http://host.docker.internal:3004/api/internal/dispatch', 'slotto_dispatch_url');
--     select vault.create_secret('<apps/web/.env.local の CRON_SECRET>', 'slotto_cron_secret');
--   本番:
--     select vault.create_secret('https://<本番のドメイン>/api/internal/dispatch', 'slotto_dispatch_url');
--     select vault.create_secret('<Vercel の CRON_SECRET と同じ値>', 'slotto_cron_secret');
--   変更: select vault.update_secret((select id from vault.secrets where name = 'slotto_dispatch_url'), '<新しい値>');
--
-- pg_cron が使えない環境では、拡張の作成と登録を飛ばす(手で dispatch を叩く: apps/web の `pnpm jobs:dispatch`)。

create extension if not exists pg_net with schema extensions;

-- 呼ぶ関数。時刻が来たジョブ(または止まったジョブ)が無ければ HTTP を送らない
create or replace function public.invoke_job_dispatch()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  if not exists (
    select 1 from public.scheduled_jobs
    where (status = 'pending' and run_at <= now())
       or (status = 'running' and locked_at < now() - interval '10 minutes')
  ) then
    return;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'slotto_dispatch_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'slotto_cron_secret' limit 1;
  if v_url is null or v_secret is null then
    raise notice 'slotto_dispatch_url / slotto_cron_secret が Vault に未登録のため、dispatch を呼びません';
    return;
  end if;

  -- pg_net は送るだけで、成否は見ない(成否は Web 側が scheduled_jobs に記録する)。
  -- 既定のタイムアウト 2 秒では dispatch の処理が終わらないので延ばす
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function public.invoke_job_dispatch() from public, anon, authenticated;

-- 古い記録を消す
create or replace function public.cleanup_job_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.scheduled_jobs
  where status in ('done', 'cancelled', 'failed')
    and coalesce(finished_at, created_at) < now() - interval '30 days';
  delete from public.automation_runs where created_at < now() - interval '90 days';
  if to_regclass('cron.job_run_details') is not null then
    execute 'delete from cron.job_run_details where end_time < now() - interval ''7 days''';
  end if;
end;
$$;

revoke execute on function public.cleanup_job_history() from public, anon, authenticated;

do $$
begin
  begin
    create extension if not exists pg_cron with schema pg_catalog;
  exception when others then
    raise notice 'pg_cron を有効にできませんでした(%)。dispatch は手で呼んでください', sqlerrm;
    return;
  end;

  -- 同じ名前のジョブがあれば置き換わる
  perform cron.schedule('slotto-dispatch-jobs', '* * * * *', 'select public.invoke_job_dispatch()');
  perform cron.schedule('slotto-cleanup-job-history', '17 3 * * *', 'select public.cleanup_job_history()');
end;
$$;
