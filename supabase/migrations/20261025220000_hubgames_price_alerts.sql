-- #37: avisos push de precio de la wishlist.
-- Una fila por usuario y juego con el criterio del aviso y lo último avisado. Sin fila = criterio por defecto
-- (mínimo histórico en Steam). Tabla aparte de hubgames_user_wishlist porque la sincronización reemplaza la wishlist
-- de Steam y se perderían los umbrales.
--
-- mode:
--   'minimo'    → cuando el precio en Steam iguala o mejora su mínimo histórico (y está rebajado).
--   'precio'    → cuando el precio baja de target_price (céntimos).
--   'descuento' → cuando el descuento llega a target_discount (%).
--   'off'       → sin avisos para ese juego.
--
-- Para no repetir: last_notified_price guarda el precio avisado. Mientras se cumpla el criterio solo se vuelve a
-- avisar si el precio baja más; cuando deja de cumplirse (acaba la oferta) se borra y el siguiente se avisa de nuevo.
-- Esas dos columnas solo las escribe el script diario (service_role).
create table if not exists public.hubgames_price_alerts (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  appid integer not null,
  mode text not null default 'minimo' check (mode in ('minimo', 'precio', 'descuento', 'off')),
  target_price integer check (target_price >= 0),
  target_discount smallint check (target_discount between 1 and 100),
  last_notified_price integer check (last_notified_price >= 0),
  last_notified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, appid),
  constraint hubgames_price_alerts_target check (
    (mode <> 'precio' or target_price is not null) and (mode <> 'descuento' or target_discount is not null)
  )
);

drop trigger if exists hubgames_price_alerts_set_updated_at on public.hubgames_price_alerts;
create trigger hubgames_price_alerts_set_updated_at
  before update on public.hubgames_price_alerts
  for each row execute function public.hubgames_set_updated_at();

alter table public.hubgames_price_alerts enable row level security;

drop policy if exists "Users can view own price alerts" on public.hubgames_price_alerts;
create policy "Users can view own price alerts" on public.hubgames_price_alerts
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own price alerts" on public.hubgames_price_alerts;
create policy "Users can insert own price alerts" on public.hubgames_price_alerts
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own price alerts" on public.hubgames_price_alerts;
create policy "Users can update own price alerts" on public.hubgames_price_alerts
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own price alerts" on public.hubgames_price_alerts;
create policy "Users can delete own price alerts" on public.hubgames_price_alerts
  for delete to authenticated using (user_id = (select auth.uid()));

-- El usuario solo elige el criterio; lo avisado no lo puede tocar.
revoke all on public.hubgames_price_alerts from anon, authenticated;
grant select, delete on public.hubgames_price_alerts to authenticated;
grant insert (user_id, appid, mode, target_price, target_discount) on public.hubgames_price_alerts to authenticated;
-- user_id y appid también, porque el upsert de PostgREST los incluye en el UPDATE (la política sigue exigiendo el propio user_id).
grant update (user_id, appid, mode, target_price, target_discount) on public.hubgames_price_alerts to authenticated;
