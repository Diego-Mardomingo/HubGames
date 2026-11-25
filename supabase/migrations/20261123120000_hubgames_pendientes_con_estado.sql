-- #140: añadir a Pendientes sin perder el estado. Marca in_backlog (como favorite y endless): el juego está en la lista
-- Pendientes con su estado de siempre (completado, ya jugado, abandonado...). El estado 'pendiente' no cambia.
alter table public.hubgames_user_games
  add column if not exists in_backlog boolean not null default false,
  -- Cuándo se añadió: una partida anterior no lo pasa a Jugando (ver tracker-rules.ts), igual que una decisión manual.
  add column if not exists in_backlog_at timestamptz;

-- La marca no tiene sentido en Pendiente (ya está en la lista), Jugando (sale de Pendientes al empezarlo) ni
-- Descartado: el trigger la quita en esos estados, a mano o por la sincronización, y mantiene in_backlog_at.
create or replace function public.hubgames_user_games_status_changed()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    if new.status_source = 'manual' then
      new.suggestion := null;
    end if;
  end if;
  if new.status in ('pendiente', 'jugando', 'descartado') then
    new.in_backlog := false;
  end if;
  if not new.in_backlog then
    new.in_backlog_at := null;
  elsif not old.in_backlog or new.in_backlog_at is null then
    new.in_backlog_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.hubgames_user_games_status_changed() from public, anon, authenticated;

-- El orden manual (backlog_position) es el mismo para los pendientes y los añadidos con su estado.
drop index if exists public.hubgames_user_games_backlog_idx;
create index hubgames_user_games_backlog_idx
  on public.hubgames_user_games (user_id, backlog_position) where status = 'pendiente' or in_backlog;

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
    and (g.status = 'pendiente' or g.in_backlog);
$$;

revoke execute on function public.hubgames_reorder_backlog(integer[]) from public, anon;
grant execute on function public.hubgames_reorder_backlog(integer[]) to authenticated;

-- La biblioteca gana la marca y su fecha (al final: create or replace view no admite reordenar).
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
  s.appid is not null and s.family_gone_at is null as owned,
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
  p.all_low_at,
  s.source as steam_source,
  case when s.source = 'family' then (
    select array_agg(coalesce(u.family_members ->> o, o) order by o) from unnest(s.family_owner_steamids) o
  ) end as family_owners,
  s.family_gone_at,
  g.in_backlog,
  g.in_backlog_at
from public.hubgames_user_games g
left join public.hubgames_user_steam_games s on s.user_id = g.user_id and s.appid = g.appid
left join public.hubgames_juegos_steam c on c.steam_appid = g.appid
left join public.hubgames_hltb h on h.appid = g.appid
left join public.hubgames_game_prices p on p.appid = g.appid
left join public.hubgames_user_steam u on u.user_id = g.user_id;

revoke all on public.hubgames_library from anon, authenticated;
grant select on public.hubgames_library to authenticated;
