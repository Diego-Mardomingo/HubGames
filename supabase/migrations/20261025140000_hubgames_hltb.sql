-- #23: duraciones de HowLongToBeat (scraper semanal en GitHub Actions), con SteamSpy de respaldo.
-- Catálogo compartido como hubgames_juegos_steam: todos lo leen y solo escribe el servidor (service_role).
create table if not exists public.hubgames_hltb (
  appid integer primary key,
  hltb_id integer,
  hltb_name text,
  -- Minutos (como playtime_forever). null = HowLongToBeat no tiene dato o no se encontró el juego.
  main integer check (main is null or main > 0),
  main_extra integer check (main_extra is null or main_extra > 0),
  completionist integer check (completionist is null or completionist > 0),
  -- Similitud del nombre (0-1) del resultado elegido. null si no se encontró.
  match_confidence numeric(4,3) check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  fetched_at timestamptz not null default now()
);

create index if not exists hubgames_hltb_fetched_idx on public.hubgames_hltb (fetched_at);

alter table public.hubgames_hltb enable row level security;

drop policy if exists "Anyone can view hltb" on public.hubgames_hltb;
create policy "Anyone can view hltb" on public.hubgames_hltb
  for select to anon, authenticated using (true);

revoke all on public.hubgames_hltb from anon, authenticated;
grant select on public.hubgames_hltb to anon, authenticated;

-- Juegos que el scraper tiene que (re)consultar: los de alguna biblioteca, tracker o wishlist
-- sin dato, con dato de más de 90 días, o no encontrados hace más de 30 días. Primero los nunca consultados.
create or replace function public.hubgames_hltb_pending(p_limit integer default 500)
returns table (appid integer, name text, release_year integer)
language sql
stable
set search_path = public
as $$
  with games as (
    select g.appid from hubgames_user_steam_games g
    union
    select t.appid from hubgames_user_games t
    union
    select w.appid from hubgames_user_wishlist w
  )
  select g.appid, c.name, extract(year from c.release_date)::integer
  from games g
  join hubgames_juegos_steam c on c.steam_appid = g.appid
  left join hubgames_hltb h on h.appid = g.appid
  where coalesce(c.type, 'game') = 'game'
    and (
      h.appid is null
      or (h.main is not null and h.fetched_at < now() - interval '90 days')
      or (h.main is null and h.fetched_at < now() - interval '30 days')
    )
  order by h.fetched_at nulls first, g.appid
  limit p_limit;
$$;

revoke execute on function public.hubgames_hltb_pending(integer) from public, anon, authenticated;
grant execute on function public.hubgames_hltb_pending(integer) to service_role;

-- Duración de cada juego para el tracker, el dashboard y "¿Qué juego hoy?": HowLongToBeat si lo hay;
-- si no, la mediana de tiempo jugado de SteamSpy como aproximación de la historia (source = 'steamspy').
create or replace view public.hubgames_game_duration
with (security_invoker = true) as
select
  c.steam_appid as appid,
  coalesce(h.main, nullif(c.steamspy_median_forever, 0)) as main,
  h.main_extra,
  h.completionist,
  case
    when h.main is not null then 'hltb'
    when nullif(c.steamspy_median_forever, 0) is not null then 'steamspy'
  end as source,
  h.hltb_id,
  h.match_confidence
from public.hubgames_juegos_steam c
left join public.hubgames_hltb h on h.appid = c.steam_appid
where h.main is not null or h.main_extra is not null or h.completionist is not null
  or nullif(c.steamspy_median_forever, 0) is not null;

revoke all on public.hubgames_game_duration from anon, authenticated;
grant select on public.hubgames_game_duration to anon, authenticated;

-- La biblioteca lleva las duraciones de HowLongToBeat (columnas nuevas al final, como pide create or replace view).
-- La regla de "¿Lo has terminado?" (#18) usa hltb_main; la mediana de SteamSpy no sirve para eso.
create or replace view public.hubgames_library
with (security_invoker = true) as
select
  g.user_id,
  g.appid,
  g.status,
  g.status_source,
  g.rating,
  g.started_at,
  g.completed_at,
  g.review,
  g.backlog_position,
  g.goal,
  g.created_at,
  g.updated_at,
  coalesce(s.playtime_forever, 0) as playtime_forever,
  coalesce(s.playtime_2weeks, 0) as playtime_2weeks,
  s.rtime_last_played,
  s.achievements_total,
  s.achievements_unlocked,
  (
    select max(a.unlocktime) from public.hubgames_user_achievements a
    where a.user_id = g.user_id and a.appid = g.appid and a.achieved
  ) as last_unlock_at,
  c.name,
  c.header_image,
  c.steamspy_userscore,
  g.status_changed_at,
  g.suggestion,
  g.suggestion_dismissed_at,
  c.genres,
  c.release_date,
  c.steamspy_median_forever,
  h.main as hltb_main,
  h.main_extra as hltb_main_extra,
  h.completionist as hltb_completionist
from public.hubgames_user_games g
left join public.hubgames_user_steam_games s on s.user_id = g.user_id and s.appid = g.appid
left join public.hubgames_juegos_steam c on c.steam_appid = g.appid
left join public.hubgames_hltb h on h.appid = g.appid;
