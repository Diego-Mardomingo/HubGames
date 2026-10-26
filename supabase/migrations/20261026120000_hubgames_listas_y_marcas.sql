-- Listas de la biblioteca: marcas que se suman al estado (Favorito y Sin final), pendientes sin comprar y lista de inicio.

-- Marcas. "Sin final" deja de ser un objetivo ('rejugable'): pasa a ser una marca compatible con cualquier estado.
alter table public.hubgames_user_games
  add column if not exists favorite boolean not null default false,
  add column if not exists endless boolean not null default false;

update public.hubgames_user_games set endless = true, goal = 'historia' where goal = 'rejugable';

alter table public.hubgames_user_games drop constraint if exists hubgames_user_games_goal_check;
alter table public.hubgames_user_games
  add constraint hubgames_user_games_goal_check check (goal in ('historia', 'extras', 'completo'));

-- Lista que abre /biblioteca por defecto, con su orden, filtros y vista ({ tab, sort, filters, view, own }).
alter table public.hubgames_usuarios add column if not exists library_home jsonb;
grant update (library_home) on public.hubgames_usuarios to authenticated;

-- La biblioteca gana las marcas, si lo tienes en Steam (owned = false: pendiente sin comprar), Metacritic y el precio
-- con sus mínimos (para los que no tienes). Columnas nuevas al final: create or replace view no admite reordenar.
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
  h.completionist as hltb_completionist,
  g.favorite,
  g.endless,
  s.appid is not null as owned,
  c.metacritic_score,
  c.is_free,
  c.coming_soon,
  p.price_initial,
  p.price_final,
  p.discount_percent,
  p.itad_id,
  p.steam_low,
  p.steam_low_at,
  p.all_low,
  p.all_low_shop,
  p.all_low_at
from public.hubgames_user_games g
left join public.hubgames_user_steam_games s on s.user_id = g.user_id and s.appid = g.appid
left join public.hubgames_juegos_steam c on c.steam_appid = g.appid
left join public.hubgames_hltb h on h.appid = g.appid
left join public.hubgames_game_prices p on p.appid = g.appid;

revoke all on public.hubgames_library from anon, authenticated;
grant select on public.hubgames_library to authenticated;
