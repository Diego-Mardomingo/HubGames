-- Notificaciones en varios dispositivos y por tipo (#90).
-- - Una fila por dispositivo: única por el endpoint de la suscripción push en lugar de por user_id.
-- - device_name (navegador + sistema, del user agent) y last_used_at para la lista de «Otros dispositivos».
-- - prefs: qué tipos recibe cada dispositivo ({"judi": true, "price": true}). Un tipo que no esté en el objeto cuenta
--   como activado, así que añadir tipos nuevos no exige migrar datos. Las filas que ya existen reciben los dos tipos.

alter table public.hubgames_push_subscriptions
  add column if not exists endpoint text generated always as (subscription ->> 'endpoint') stored,
  add column if not exists device_name text,
  add column if not exists prefs jsonb not null default '{"judi": true, "price": true}'::jsonb,
  add column if not exists last_used_at timestamptz not null default now();

alter table public.hubgames_push_subscriptions
  drop constraint if exists hubgames_push_subscriptions_user_id_unique;

-- Por si hubiera filas sin endpoint (no debería: toJSON() de PushSubscription siempre lo trae).
delete from public.hubgames_push_subscriptions where endpoint is null;

alter table public.hubgames_push_subscriptions
  add constraint hubgames_push_subscriptions_endpoint_not_null check (endpoint is not null),
  add constraint hubgames_push_subscriptions_endpoint_unique unique (endpoint),
  add constraint hubgames_push_subscriptions_prefs_object check (jsonb_typeof(prefs) = 'object');

-- Activa (o crea) la suscripción de ESTE dispositivo para el usuario actual sin tocar las de sus otros dispositivos.
-- Es SECURITY DEFINER porque el endpoint pertenece al navegador: si en el mismo navegador entra otra cuenta, la fila
-- pasa a esa cuenta (con preferencias por defecto) en lugar de fallar por RLS. Si es del mismo usuario, conserva sus
-- preferencias por tipo, de modo que al reactivar se recuperan.
create or replace function public.hubgames_push_register(p_subscription jsonb, p_device_name text)
returns table (id uuid, prefs jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;
  if p_subscription ->> 'endpoint' is null then
    raise exception 'Suscripción sin endpoint' using errcode = '22023';
  end if;

  return query
  insert into public.hubgames_push_subscriptions as s (user_id, subscription, device_name, enabled, last_used_at)
  values (v_user, p_subscription, left(p_device_name, 80), true, now())
  on conflict (endpoint) do update set
    prefs = case when s.user_id = excluded.user_id then s.prefs else excluded.prefs end,
    user_id = excluded.user_id,
    subscription = excluded.subscription,
    device_name = excluded.device_name,
    enabled = true,
    last_used_at = now(),
    updated_at = now()
  returning s.id, s.prefs;
end;
$$;

revoke all on function public.hubgames_push_register(jsonb, text) from public, anon;
grant execute on function public.hubgames_push_register(jsonb, text) to authenticated;
