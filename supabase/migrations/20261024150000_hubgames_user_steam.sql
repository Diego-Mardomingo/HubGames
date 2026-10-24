-- #11: vinculación de Steam por usuario. Solo escribe el servidor (service_role); el usuario lee y borra la suya.
create table if not exists public.hubgames_user_steam (
  user_id uuid primary key references public.hubgames_usuarios(id) on delete cascade,
  steamid text not null unique check (steamid ~ '^\d{17}$'),
  persona_name text,
  avatar text,
  visibility text not null default 'desconocida'
    check (visibility in ('publico', 'privado', 'detalles_privados', 'desconocida')),
  linked_at timestamptz not null default now(),
  last_sync_at timestamptz
);

alter table public.hubgames_user_steam enable row level security;

drop policy if exists "Users can view own steam link" on public.hubgames_user_steam;
create policy "Users can view own steam link" on public.hubgames_user_steam
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Users can delete own steam link" on public.hubgames_user_steam;
create policy "Users can delete own steam link" on public.hubgames_user_steam
  for delete to authenticated using (user_id = (select auth.uid()));

revoke all on public.hubgames_user_steam from anon, authenticated;
grant select, delete on public.hubgames_user_steam to authenticated;
