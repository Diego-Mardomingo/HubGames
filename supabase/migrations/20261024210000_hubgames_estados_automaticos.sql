-- #18: estados automáticos y sugerencias. Las reglas viven en src/lib/tracker-rules.ts y las aplica la sincronización.

alter table public.hubgames_user_games
  -- Cuándo cambió el estado por última vez: una decisión manual solo la revoca actividad posterior.
  add column if not exists status_changed_at timestamptz not null default now(),
  -- Sugerencia pendiente de resolver ("¿Lo has terminado?" o "¿Lo dejas en pausa?").
  add column if not exists suggestion text check (suggestion in ('pausado', 'completado')),
  -- Al descartar una sugerencia no se repite por el mismo motivo (ver tracker-rules.ts).
  add column if not exists suggestion_dismissed_at timestamptz;

update public.hubgames_user_games set status_changed_at = created_at where status_changed_at > created_at;

-- Mantiene status_changed_at. Un cambio manual de estado resuelve cualquier sugerencia pendiente.
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
  return new;
end;
$$;

revoke execute on function public.hubgames_user_games_status_changed() from public, anon, authenticated;

drop trigger if exists hubgames_user_games_status_changed on public.hubgames_user_games;
create trigger hubgames_user_games_status_changed
  before update on public.hubgames_user_games
  for each row execute function public.hubgames_user_games_status_changed();

-- La vista gana las columnas nuevas (al final: create or replace view no admite reordenar).
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
  g.suggestion_dismissed_at
from public.hubgames_user_games g
left join public.hubgames_user_steam_games s on s.user_id = g.user_id and s.appid = g.appid
left join public.hubgames_juegos_steam c on c.steam_appid = g.appid;
