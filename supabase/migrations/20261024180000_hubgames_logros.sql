-- #13: logros de Steam. Esquema y rareza compartidos por juego; desbloqueos por usuario.

-- Control por juego: cuándo se trajo el esquema y la rareza. total = 0 marca los juegos sin logros (no se vuelven a pedir).
create table if not exists public.hubgames_steam_achievement_apps (
  appid integer primary key,
  total integer not null default 0 check (total >= 0),
  schema_synced_at timestamptz not null default now(),
  percents_synced_at timestamptz
);

create table if not exists public.hubgames_steam_achievement_schema (
  appid integer not null,
  apiname text not null,
  display_name text,
  description text,
  icon text,
  icongray text,
  hidden boolean not null default false,
  global_percent numeric(6,3),
  updated_at timestamptz not null default now(),
  primary key (appid, apiname)
);

create table if not exists public.hubgames_user_achievements (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  appid integer not null,
  apiname text not null,
  achieved boolean not null default false,
  unlocktime timestamptz,
  primary key (user_id, appid, apiname)
);

create index if not exists hubgames_user_achievements_unlock_idx
  on public.hubgames_user_achievements (user_id, unlocktime desc) where achieved;

-- Resumen por juego y control de la sincronización incremental.
alter table public.hubgames_user_steam_games
  add column if not exists achievements_total integer,
  add column if not exists achievements_unlocked integer,
  add column if not exists achievements_synced_at timestamptz;

drop trigger if exists hubgames_steam_achievement_schema_set_updated_at on public.hubgames_steam_achievement_schema;
create trigger hubgames_steam_achievement_schema_set_updated_at
  before update on public.hubgames_steam_achievement_schema
  for each row execute function public.hubgames_set_updated_at();

alter table public.hubgames_steam_achievement_apps enable row level security;
alter table public.hubgames_steam_achievement_schema enable row level security;
alter table public.hubgames_user_achievements enable row level security;

-- El esquema y la rareza son datos públicos de Steam, como el catálogo.
drop policy if exists "Anyone can view achievement apps" on public.hubgames_steam_achievement_apps;
create policy "Anyone can view achievement apps" on public.hubgames_steam_achievement_apps
  for select to anon, authenticated using (true);

drop policy if exists "Anyone can view achievement schema" on public.hubgames_steam_achievement_schema;
create policy "Anyone can view achievement schema" on public.hubgames_steam_achievement_schema
  for select to anon, authenticated using (true);

drop policy if exists "Users can view own achievements" on public.hubgames_user_achievements;
create policy "Users can view own achievements" on public.hubgames_user_achievements
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_steam_achievement_apps, public.hubgames_steam_achievement_schema,
  public.hubgames_user_achievements from anon, authenticated;
grant select on public.hubgames_steam_achievement_apps, public.hubgames_steam_achievement_schema to anon, authenticated;
grant select on public.hubgames_user_achievements to authenticated;
