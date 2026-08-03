CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

SELECT cron.schedule(
  'patrimonio-snapshot-daily',
  '0 6 * * *', -- 06:00 UTC = 00:00 America/Mexico_City (no DST)
  $$
  SELECT net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/patrimonio-snapshot-daily',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = '<SERVICE_ROLE_SECRET_NAME>'
      )
    )
  );
  $$
);
