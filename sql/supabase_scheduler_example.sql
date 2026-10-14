-- Optional 15-minute, 24/7 poller. Requires pg_cron + pg_net + Supabase Vault.
-- Configure BOTH Vault secrets manually before running cron.schedule:
-- select vault.create_secret('https://YOUR-DEPLOYED-SITE.vercel.app','eh_app_url');
-- select vault.create_secret('YOUR_LONG_RANDOM_CRON_SECRET','eh_cron_secret');
-- CRON_SECRET must also be set on Vercel. Do NOT paste secrets in a public git repository.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('equal-horizons-world-ingest','*/15 * * * *',$$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name='eh_app_url') || '/api/cron/ingest',
    headers := jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='eh_cron_secret')),
    timeout_milliseconds := 55000
  );
$$);
-- Inspect: select * from cron.job_run_details order by start_time desc limit 20;
-- Disable: select cron.unschedule('equal-horizons-world-ingest');
