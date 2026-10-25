-- #31: metas mensuales ("terminar 2 juegos", "50 logros", "1 juego al 100 %"). Solo se guarda el objetivo:
-- el progreso se calcula con los datos sincronizados. Cada usuario ve y gestiona las suyas.
create table if not exists public.hubgames_monthly_goals (
  user_id uuid not null references public.hubgames_usuarios(id) on delete cascade,
  -- Primer día del mes (hora de Madrid).
  month date not null check (extract(day from month) = 1),
  kind text not null check (kind in ('completar', 'logros', 'perfectos')),
  target integer not null check (target between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, month, kind)
);

drop trigger if exists hubgames_monthly_goals_set_updated_at on public.hubgames_monthly_goals;
create trigger hubgames_monthly_goals_set_updated_at
  before update on public.hubgames_monthly_goals
  for each row execute function public.hubgames_set_updated_at();

alter table public.hubgames_monthly_goals enable row level security;

drop policy if exists "Users can view own goals" on public.hubgames_monthly_goals;
create policy "Users can view own goals" on public.hubgames_monthly_goals
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can insert own goals" on public.hubgames_monthly_goals;
create policy "Users can insert own goals" on public.hubgames_monthly_goals
  for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "Users can update own goals" on public.hubgames_monthly_goals;
create policy "Users can update own goals" on public.hubgames_monthly_goals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "Users can delete own goals" on public.hubgames_monthly_goals;
create policy "Users can delete own goals" on public.hubgames_monthly_goals
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_monthly_goals from anon, authenticated;
grant select, insert, update, delete on public.hubgames_monthly_goals to authenticated;
