-- #16: estado de cada juego para cada usuario (tracker). Cada usuario ve y gestiona solo los suyos.
-- Sin FK a hubgames_juegos_steam: un juego puede estar en la biblioteca antes de tener ficha en el catálogo.
create table if not exists public.hubgames_user_games (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  appid integer not null,
  status text not null default 'bandeja'
    check (status in ('bandeja', 'pendiente', 'jugando', 'pausado', 'completado', 'abandonado', 'descartado')),
  status_source text not null default 'auto' check (status_source in ('auto', 'manual')),
  rating numeric(3,1)
    check (rating is null or (rating >= 0 and rating <= 10 and rating * 2 = round(rating * 2))),
  started_at timestamptz,
  completed_at timestamptz,
  review text,
  backlog_position integer,
  goal text not null default 'historia' check (goal in ('historia', 'extras', 'completo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, appid)
);

create index if not exists hubgames_user_games_user_status_idx on public.hubgames_user_games (user_id, status);
create index if not exists hubgames_user_games_backlog_idx
  on public.hubgames_user_games (user_id, backlog_position) where status = 'pendiente';

drop trigger if exists hubgames_user_games_set_updated_at on public.hubgames_user_games;
create trigger hubgames_user_games_set_updated_at
  before update on public.hubgames_user_games
  for each row execute function public.hubgames_set_updated_at();

alter table public.hubgames_user_games enable row level security;

drop policy if exists "Users can view own games" on public.hubgames_user_games;
create policy "Users can view own games" on public.hubgames_user_games
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own games" on public.hubgames_user_games;
create policy "Users can insert own games" on public.hubgames_user_games
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own games" on public.hubgames_user_games;
create policy "Users can update own games" on public.hubgames_user_games
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own games" on public.hubgames_user_games;
create policy "Users can delete own games" on public.hubgames_user_games
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_user_games from anon, authenticated;
grant select, insert, update, delete on public.hubgames_user_games to authenticated;
