-- #63 (1/2): la Edge Function send_daily_judi_notifications deja de aceptar la anon key.
-- - El cron manda un secreto propio en la cabecera x-cron-secret. El secreto vive en Vault y el job lo lee de ahí:
--   no queda ninguna clave escrita en cron.job.
-- - La Edge Function (verify_jwt = false) lo comprueba llamando a hubgames_verify_cron_secret() con la service role,
--   así no hace falta copiar el secreto a los secrets de la función. Sin cabecera o con otra cosa: 401.

-- Secreto aleatorio, solo si no existe (la migración se puede repetir).
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'hubgames_judi_cron_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'hubgames_judi_cron_secret',
      'Cabecera x-cron-secret del cron de avisos JUDI (#63)'
    );
  end if;
end
$$;

create or replace function public.hubgames_verify_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(p_secret, '') <> '' and exists (
    select 1 from vault.decrypted_secrets
    where name = 'hubgames_judi_cron_secret' and decrypted_secret = p_secret
  );
$$;

revoke execute on function public.hubgames_verify_cron_secret(text) from public, anon, authenticated;
grant execute on function public.hubgames_verify_cron_secret(text) to service_role;

-- Mismo nombre y horario: cron.schedule sustituye el comando del job existente.
select cron.schedule(
  'judi-daily-notifications-17h-spain',
  '0 16 * * *',
  $cron$
    select net.http_post(
      url := 'https://hrpwtsnsxnogjpsxslwi.supabase.co/functions/v1/send_daily_judi_notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'hubgames_judi_cron_secret')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $cron$
);

-- Nadie la llamaba (el cron va directo a la Edge Function) y repetía la URL y la anon key.
drop function if exists public.run_judi_daily_notification();
