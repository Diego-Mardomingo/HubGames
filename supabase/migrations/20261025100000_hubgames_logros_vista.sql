-- #25: vista de logros por usuario con su esquema (nombre, descripción, icono, oculto y rareza global).
-- security invoker: las RLS de hubgames_user_achievements limitan cada usuario a sus logros.
create or replace view public.hubgames_achievements
with (security_invoker = true) as
select
  a.user_id,
  a.appid,
  a.apiname,
  a.achieved,
  a.unlocktime,
  s.display_name,
  s.description,
  s.icon,
  s.icongray,
  s.hidden,
  s.global_percent
from public.hubgames_user_achievements a
join public.hubgames_steam_achievement_schema s on s.appid = a.appid and s.apiname = a.apiname;

revoke all on public.hubgames_achievements from anon, authenticated;
grant select on public.hubgames_achievements to authenticated;

-- Para "logros fáciles que te faltan" (#26): los no desbloqueados de cada usuario.
create index if not exists hubgames_user_achievements_locked_idx
  on public.hubgames_user_achievements (user_id, appid) where not achieved;
