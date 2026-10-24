-- #21: vista de biblioteca. Datos para filtrar (géneros, lanzamiento, duración), orden de pendientes y límite de "Jugando".

-- Límite de juegos en "Jugando": solo avisa, no bloquea.
alter table public.hubgames_usuarios
  add column if not exists playing_limit smallint not null default 3 check (playing_limit between 1 and 20);

grant update (playing_limit) on public.hubgames_usuarios to authenticated;

-- La vista gana géneros, fecha de lanzamiento y la mediana de SteamSpy (duración de respaldo hasta #23). Al final:
-- create or replace view no admite reordenar columnas.
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
  c.steamspy_median_forever
from public.hubgames_user_games g
left join public.hubgames_user_steam_games s on s.user_id = g.user_id and s.appid = g.appid
left join public.hubgames_juegos_steam c on c.steam_appid = g.appid;

revoke all on public.hubgames_library from anon, authenticated;
grant select on public.hubgames_library to authenticated;

-- Orden de los pendientes al arrastrar: la posición es el índice en el array (1, 2, 3...).
-- security invoker: las RLS limitan el update a los juegos del propio usuario.
create or replace function public.hubgames_reorder_backlog(p_appids integer[])
returns void
language sql
security invoker
set search_path = public
as $$
  update public.hubgames_user_games g
  set backlog_position = t.ord
  from unnest(p_appids) with ordinality as t(appid, ord)
  where g.user_id = (select auth.uid())
    and g.appid = t.appid
    and g.status = 'pendiente';
$$;

revoke execute on function public.hubgames_reorder_backlog(integer[]) from public, anon;
grant execute on function public.hubgames_reorder_backlog(integer[]) to authenticated;
