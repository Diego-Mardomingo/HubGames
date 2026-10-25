-- run_judi_daily_notification() es SECURITY DEFINER y, por los permisos por defecto de Postgres, la podía
-- ejecutar cualquiera vía /rest/v1/rpc (incluido anon), disparando el envío de avisos push de JUDI.
-- Nadie la llama desde la app: el cron (que corre como postgres) invoca directamente la Edge Function.
-- Se deja solo para postgres y service_role, y se fija el search_path como pide el advisor.
revoke execute on function public.run_judi_daily_notification() from public, anon, authenticated;
grant execute on function public.run_judi_daily_notification() to service_role;

alter function public.run_judi_daily_notification() set search_path = '';
