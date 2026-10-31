-- #86: juegos que presta el grupo familiar de Steam. Se traen a demanda desde /perfil con un login por QR cuyo permiso
-- se usa unos segundos y se anula en Steam: aquí no se guarda ningún permiso, solo la lista.
--   source = 'own'    → de tu biblioteca (GetOwnedGames, como hasta ahora)
--   source = 'family' → te lo presta alguien del grupo (GetSharedLibraryApps); family_gone_at si dejó de estar.
alter table public.hubgames_user_steam_games
  add column if not exists source text not null default 'own' check (source in ('own', 'family')),
  add column if not exists family_owner_steamids text[],
  add column if not exists family_gone_at timestamptz;

-- Última actualización del grupo y nombres de sus miembros ({ steamid: persona_name }) para «Del grupo · laura_g».
alter table public.hubgames_user_steam
  add column if not exists family_synced_at timestamptz,
  add column if not exists family_members jsonb;

-- Biblioteca: «owned» pasa a ser «lo puedes jugar» (propio o prestado ahora mismo). Columnas nuevas al final:
-- steam_source, family_owners (nombres de quien lo presta) y family_gone_at («Ya no está en el grupo»).
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
  s.family_gone_at
from public.hubgames_user_games g
left join public.hubgames_user_steam_games s on s.user_id = g.user_id and s.appid = g.appid
left join public.hubgames_juegos_steam c on c.steam_appid = g.appid
left join public.hubgames_hltb h on h.appid = g.appid
left join public.hubgames_game_prices p on p.appid = g.appid
left join public.hubgames_user_steam u on u.user_id = g.user_id;

revoke all on public.hubgames_library from anon, authenticated;
grant select on public.hubgames_library to authenticated;

-- Wishlist: los prestados se pueden desear (para comprarlos tú); solo se ocultan los tuyos. in_family para el aviso.
create or replace view public.hubgames_wishlist
with (security_invoker = true) as
select
  w.user_id,
  w.appid,
  w.source,
  w.priority,
  w.date_added,
  c.name,
  c.header_image,
  c.release_date,
  c.release_date_text,
  c.coming_soon,
  c.is_free,
  c.genres,
  c.steamspy_userscore,
  p.currency,
  p.price_initial,
  p.price_final,
  p.discount_percent,
  p.price_synced_at,
  p.itad_id,
  p.steam_low,
  p.steam_low_at,
  p.all_low,
  p.all_low_shop,
  p.all_low_at,
  c.metacritic_score,
  c.steamspy_median_forever,
  h.main as hltb_main,
  h.main_extra as hltb_main_extra,
  h.completionist as hltb_completionist,
  exists (
    select 1 from public.hubgames_user_steam_games f
    where f.user_id = w.user_id and f.appid = w.appid and f.source = 'family' and f.family_gone_at is null
  ) as in_family
from public.hubgames_user_wishlist w
left join public.hubgames_juegos_steam c on c.steam_appid = w.appid
left join public.hubgames_game_prices p on p.appid = w.appid
left join public.hubgames_hltb h on h.appid = w.appid
where not exists (
  select 1 from public.hubgames_user_steam_games s where s.user_id = w.user_id and s.appid = w.appid and s.source = 'own'
);

revoke all on public.hubgames_wishlist from anon, authenticated;
grant select on public.hubgames_wishlist to authenticated;
