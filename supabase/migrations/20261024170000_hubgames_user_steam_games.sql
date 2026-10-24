-- #12: biblioteca de Steam por usuario (GetOwnedGames). Solo escribe el servidor (service_role); el usuario la lee.
create table if not exists public.hubgames_user_steam_games (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  appid integer not null,
  playtime_forever integer not null default 0 check (playtime_forever >= 0),
  playtime_2weeks integer not null default 0 check (playtime_2weeks >= 0),
  rtime_last_played timestamptz,
  first_seen_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, appid)
);

drop trigger if exists hubgames_user_steam_games_set_updated_at on public.hubgames_user_steam_games;
create trigger hubgames_user_steam_games_set_updated_at
  before update on public.hubgames_user_steam_games
  for each row execute function public.hubgames_set_updated_at();

alter table public.hubgames_user_steam_games enable row level security;

drop policy if exists "Users can view own steam games" on public.hubgames_user_steam_games;
create policy "Users can view own steam games" on public.hubgames_user_steam_games
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_user_steam_games from anon, authenticated;
grant select on public.hubgames_user_steam_games to authenticated;
