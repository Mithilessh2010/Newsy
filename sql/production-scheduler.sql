create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('equal-horizons-local-15m','*/15 * * * *',$job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name='eh_app_url') || '/api/cron/ingest',
    headers := jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='eh_cron_secret')),
    timeout_milliseconds := 55000
  );
$job$);
select cron.schedule('equal-horizons-global-15m','5,20,35,50 * * * *',$job$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name='eh_app_url') || '/api/cron/ingest-global',
    headers := jsonb_build_object('Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='eh_cron_secret')),
    timeout_milliseconds := 55000
  );
$job$);
