-- #15 bis: minutos por día repartidos según la hora real de juego (Madrid), no según cuándo corre la sincronización.
-- Antes el día de cada foto era «hora de Madrid − 6 h», pensado para un cron de madrugada; pero GitHub retrasa el cron
-- hasta las 7-8 h y todo lo jugado la noche anterior caía en el día de la foto. Además, una sesión que cruza la
-- medianoche no se podía partir. Ahora cada aumento de horas se coloca como una sesión que termina en
-- rtime_last_played (la última vez que se cerró el juego) y se reparte entre los días de Madrid que toca.

-- Instante de cada foto: acota la sesión por la izquierda (no se pudo jugar antes de la foto anterior).
alter table public.hubgames_playtime_snapshots add column if not exists taken_at timestamptz;

-- Fotos anteriores: la última sincronización dentro de su día (con el desfase de 6 h de entonces), o el final de ese día.
update public.hubgames_playtime_snapshots s
set taken_at = coalesce(
  (select max(l.started_at) from public.hubgames_sync_logs l
   where l.user_id = s.user_id
     and l.started_at >= ((s.date::timestamp + interval '6 hours') at time zone 'Europe/Madrid')
     and l.started_at < (((s.date + 1)::timestamp + interval '6 hours') at time zone 'Europe/Madrid')),
  ((s.date + 1)::timestamp + interval '6 hours') at time zone 'Europe/Madrid')
where s.taken_at is null;

alter table public.hubgames_playtime_snapshots alter column taken_at set default now();
alter table public.hubgames_playtime_snapshots alter column taken_at set not null;

-- Reparte p_minutes entre los días de Madrid. La sesión termina en p_last_played (o en p_to si no hay dato), nunca
-- antes de p_from + p_minutes ni después de p_to, y empieza p_minutes antes sin bajar de p_from. El redondeo es
-- acumulado para que la suma sea exacta.
create or replace function public.hubgames_split_playtime(p_from timestamptz, p_to timestamptz, p_last_played timestamptz, p_minutes integer)
returns table (day date, minutes integer)
language sql
stable
set search_path = public
as $$
  with e as (
    select least(p_to, greatest(coalesce(p_last_played, p_to), p_from + make_interval(mins => p_minutes))) as e
  ),
  w as (
    select greatest(p_from, e.e - make_interval(mins => p_minutes)) as s, e.e from e
  ),
  days as (
    select g::date as day, w.s, w.e,
      greatest(w.s, (g::date::timestamp at time zone 'Europe/Madrid')) as ds,
      least(w.e, ((g::date + 1)::timestamp at time zone 'Europe/Madrid')) as de
    from w, generate_series((w.s at time zone 'Europe/Madrid')::date, (w.e at time zone 'Europe/Madrid')::date, interval '1 day') g
  ),
  f as (
    select day,
      coalesce(extract(epoch from de - s) / nullif(extract(epoch from e - s), 0), 1) as cum_to,
      coalesce(extract(epoch from ds - s) / nullif(extract(epoch from e - s), 0), 0) as cum_from
    from days
  )
  select day, (round(p_minutes * cum_to) - round(p_minutes * cum_from))::integer as minutes
  from f
  where round(p_minutes * cum_to) - round(p_minutes * cum_from) > 0;
$$;

revoke execute on function public.hubgames_split_playtime(timestamptz, timestamptz, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.hubgames_split_playtime(timestamptz, timestamptz, timestamptz, integer) to service_role;

-- Minutos jugados por día y juego, ya repartidos. Se suman en cada sincronización que ve horas nuevas.
create table if not exists public.hubgames_playtime_minutes (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  appid integer not null,
  date date not null,
  minutes integer not null check (minutes > 0),
  primary key (user_id, appid, date)
);

alter table public.hubgames_playtime_minutes enable row level security;

drop policy if exists "Users can view own playtime minutes" on public.hubgames_playtime_minutes;
create policy "Users can view own playtime minutes" on public.hubgames_playtime_minutes
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_playtime_minutes from anon, authenticated;
grant select on public.hubgames_playtime_minutes to authenticated;

-- Histórico: la diferencia entre fotos consecutivas. La última de cada juego se reparte con rtime_last_played si cae
-- entre las dos fotos (es el único dato de hora que hay); las demás se quedan en el día que tenían.
insert into public.hubgames_playtime_minutes (user_id, appid, date, minutes)
select x.user_id, x.appid, sp.day, sum(sp.minutes)::integer
from (
  select t.*, g.rtime_last_played,
    row_number() over (partition by t.user_id, t.appid order by t.date desc) as rn
  from (
    select user_id, appid, date, taken_at,
      playtime_forever - lag(playtime_forever) over w as delta,
      lag(taken_at) over w as prev_at
    from public.hubgames_playtime_snapshots
    window w as (partition by user_id, appid order by date)
  ) t
  left join public.hubgames_user_steam_games g on g.user_id = t.user_id and g.appid = t.appid
  where t.delta > 0
) x
cross join lateral (
  select * from public.hubgames_split_playtime(x.prev_at, x.taken_at, x.rtime_last_played, x.delta)
  where x.rn = 1 and x.rtime_last_played > x.prev_at and x.rtime_last_played <= x.taken_at
  union all
  select x.date, x.delta
  where not (x.rn = 1 and x.rtime_last_played > x.prev_at and x.rtime_last_played <= x.taken_at) or x.rtime_last_played is null
) sp
group by x.user_id, x.appid, sp.day
on conflict (user_id, appid, date) do nothing;

-- La foto ahora lleva el día de Madrid sin desfase (solo sirve para saber desde cuándo se mide) y su instante.
-- Si las horas han subido, los minutos nuevos se reparten y se suman a hubgames_playtime_minutes.
create or replace function public.hubgames_take_playtime_snapshot(p_user_id uuid)
returns integer
language sql
set search_path = public
as $$
  with d as (select now() as t, (now() at time zone 'Europe/Madrid')::date as day),
  changed as (
    select g.user_id, g.appid, g.playtime_forever, g.rtime_last_played,
      prev.playtime_forever as prev_playtime, prev.taken_at as prev_at
    from hubgames_user_steam_games g
    left join lateral (
      select s.playtime_forever, s.taken_at from hubgames_playtime_snapshots s
      where s.user_id = g.user_id and s.appid = g.appid
      order by s.date desc limit 1
    ) prev on true
    where g.user_id = p_user_id and prev.playtime_forever is distinct from g.playtime_forever
  ),
  mins as (
    insert into hubgames_playtime_minutes (user_id, appid, date, minutes)
    select c.user_id, c.appid, sp.day, sp.minutes
    from changed c
    cross join d
    cross join lateral hubgames_split_playtime(c.prev_at, d.t, c.rtime_last_played, c.playtime_forever - c.prev_playtime) sp
    where c.playtime_forever > c.prev_playtime
    on conflict (user_id, appid, date) do update set minutes = hubgames_playtime_minutes.minutes + excluded.minutes
  ),
  ins as (
    insert into hubgames_playtime_snapshots (user_id, appid, date, playtime_forever, taken_at)
    select c.user_id, c.appid, d.day, c.playtime_forever, d.t
    from changed c
    cross join d
    on conflict (user_id, appid, date) do update set playtime_forever = excluded.playtime_forever, taken_at = excluded.taken_at
    returning 1
  )
  select count(*)::integer from ins;
$$;

revoke execute on function public.hubgames_take_playtime_snapshot(uuid) from public, anon, authenticated;
grant execute on function public.hubgames_take_playtime_snapshot(uuid) to service_role;

-- Misma vista y columnas que antes: el resto de la app no cambia.
create or replace view public.hubgames_playtime_daily
with (security_invoker = true) as
select user_id, appid, date, minutes
from public.hubgames_playtime_minutes;

revoke all on public.hubgames_playtime_daily from anon, authenticated;
grant select on public.hubgames_playtime_daily to authenticated;

-- Al desvincular Steam también se borran los minutos por día.
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
  delete from hubgames_playtime_minutes where user_id = old.user_id;
  delete from hubgames_user_wishlist where user_id = old.user_id and source = 'steam';
  return old;
end;
$$;

revoke execute on function public.hubgames_user_steam_cleanup() from public, anon, authenticated;
