-- #14: registro de cada sincronización con Steam (cron diario y botón "Sincronizar ahora").
create table if not exists public.hubgames_sync_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  source text not null check (source in ('cron', 'manual')),
  status text not null default 'en_curso' check (status in ('en_curso', 'ok', 'parcial', 'error')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  stats jsonb,
  error text
);

create index if not exists hubgames_sync_logs_user_started_idx on public.hubgames_sync_logs (user_id, started_at desc);
create index if not exists hubgames_sync_logs_started_idx on public.hubgames_sync_logs (started_at desc);

alter table public.hubgames_sync_logs enable row level security;

drop policy if exists "Users and admins can view sync logs" on public.hubgames_sync_logs;
create policy "Users and admins can view sync logs" on public.hubgames_sync_logs
  for select to authenticated using (user_id = (select auth.uid()) or (select public.is_admin()));

revoke all on public.hubgames_sync_logs from anon, authenticated;
grant select on public.hubgames_sync_logs to authenticated;

-- #15: foto diaria de horas. Solo se guarda fila cuando playtime_forever cambia respecto a la foto anterior.
create table if not exists public.hubgames_playtime_snapshots (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  appid integer not null,
  date date not null,
  playtime_forever integer not null check (playtime_forever >= 0),
  primary key (user_id, appid, date)
);

alter table public.hubgames_playtime_snapshots enable row level security;

drop policy if exists "Users can view own playtime snapshots" on public.hubgames_playtime_snapshots;
create policy "Users can view own playtime snapshots" on public.hubgames_playtime_snapshots
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_playtime_snapshots from anon, authenticated;
grant select on public.hubgames_playtime_snapshots to authenticated;

-- Toma la foto a partir de hubgames_user_steam_games (recién sincronizada). El día es el de Madrid con 6 h de retraso:
-- el cron de madrugada cuenta como el día anterior, que es cuando se jugó. Se compara con la última foto (incluida
-- la de hoy): si no hay cambio no se escribe nada, y si lo hay el mismo día se actualiza esa fila.
create or replace function public.hubgames_take_playtime_snapshot(p_user_id uuid)
returns integer
language sql
set search_path = public
as $$
  with d as (select ((now() at time zone 'Europe/Madrid') - interval '6 hours')::date as day),
  ins as (
    insert into hubgames_playtime_snapshots (user_id, appid, date, playtime_forever)
    select g.user_id, g.appid, d.day, g.playtime_forever
    from hubgames_user_steam_games g
    cross join d
    left join lateral (
      select s.playtime_forever from hubgames_playtime_snapshots s
      where s.user_id = g.user_id and s.appid = g.appid and s.date <= d.day
      order by s.date desc limit 1
    ) prev on true
    where g.user_id = p_user_id and prev.playtime_forever is distinct from g.playtime_forever
    on conflict (user_id, appid, date) do update set playtime_forever = excluded.playtime_forever
    returning 1
  )
  select count(*)::integer from ins;
$$;

revoke execute on function public.hubgames_take_playtime_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.hubgames_take_playtime_snapshot(uuid) to service_role;

-- Minutos jugados por día y juego: diferencia con la foto anterior. La primera foto de cada juego no cuenta
-- (es el total acumulado antes de empezar a medir). Si el cron se salta días, los minutos caen en el día de la foto.
create or replace view public.hubgames_playtime_daily
with (security_invoker = true) as
select user_id, appid, date, minutes
from (
  select user_id, appid, date,
    playtime_forever - lag(playtime_forever) over (partition by user_id, appid order by date) as minutes
  from public.hubgames_playtime_snapshots
) t
where minutes > 0;

revoke all on public.hubgames_playtime_daily from anon, authenticated;
grant select on public.hubgames_playtime_daily to authenticated;

-- Al desvincular Steam se borran los datos que vienen de Steam (no el tracker: estados, notas y reseñas son del usuario).
create or replace function public.hubgames_user_steam_cleanup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from hubgames_user_steam_games where user_id = old.user_id;
  delete from hubgames_user_achievements where user_id = old.user_id;
  delete from hubgames_playtime_snapshots where user_id = old.user_id;
  return old;
end;
$$;

revoke execute on function public.hubgames_user_steam_cleanup() from public, anon, authenticated;

drop trigger if exists hubgames_user_steam_cleanup on public.hubgames_user_steam;
create trigger hubgames_user_steam_cleanup
  after delete on public.hubgames_user_steam
  for each row execute function public.hubgames_user_steam_cleanup();
