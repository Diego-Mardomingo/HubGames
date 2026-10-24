-- #5: cerrar la lectura pública de datos personales y de las respuestas de JUDI.
-- Solo toca objetos hubgames_* (la base de datos es compartida con ECOS).

-- Parte B (restrictiva): se aplica una vez desplegado el cliente que usa los RPC de la parte A.

-- 1) Alta de perfil en el servidor (sustituye a los INSERT desde el cliente).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  is_google boolean;
begin
  is_google := (new.raw_app_meta_data->>'provider' = 'google')
    or coalesce(new.raw_app_meta_data->'providers' ? 'google', false);

  insert into public.hubgames_usuarios (
    id, email, username, email_verificado, cuenta_google, fecha_creacion, administrador, password_hash
  )
  values (
    new.id,
    new.email,
    coalesce(
      nullif(btrim(new.raw_user_meta_data->>'username'), ''),
      nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data->>'name'), ''),
      split_part(new.email, '@', 1)
    ),
    true,
    is_google,
    now(),
    false,
    null
  )
  on conflict do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_hubgames_auth_user_created on auth.users;
create trigger on_hubgames_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- 2) hubgames_usuarios: cada usuario ve su fila y solo puede cambiar su username.
drop policy if exists "Allow user registration" on public.hubgames_usuarios;
drop policy if exists "Users can view all profiles" on public.hubgames_usuarios;
drop policy if exists "Users can update own profile" on public.hubgames_usuarios;

create policy "Users can view own profile" on public.hubgames_usuarios
  for select to authenticated using (auth.uid() = id);
create policy "Users can update own username" on public.hubgames_usuarios
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

revoke all on public.hubgames_usuarios from anon, authenticated;
grant select on public.hubgames_usuarios to authenticated;
grant update (username) on public.hubgames_usuarios to authenticated;


-- 5) Progreso de JUDI: cada usuario solo lee el suyo.
drop policy if exists "Anyone can view JUDI progress" on public.hubgames_judi_fases_usuario;
create policy "Users can view own progress" on public.hubgames_judi_fases_usuario
  for select to authenticated using (auth.uid() = id_usuario);


-- 6) Juegos de JUDI: solo los de hoy o anteriores (Madrid); el admin los ve todos.
drop policy if exists "Anyone can view JUDI games" on public.hubgames_lista_videojuegos_judi;
create policy "Public can view released JUDI games" on public.hubgames_lista_videojuegos_judi
  for select to anon, authenticated
  using (to_date(fecha, 'DD-MM-YYYY') <= (now() at time zone 'Europe/Madrid')::date);
create policy "Admins can view all JUDI games" on public.hubgames_lista_videojuegos_judi
  for select to authenticated using (public.is_admin());


-- 7) Logs de generación: admin por columna, sin email escrito en la política.
drop policy if exists "Admins can read judi generacion logs" on public.hubgames_judi_generacion_logs;
create policy "Admins can read judi generacion logs" on public.hubgames_judi_generacion_logs
  for select to authenticated using (public.is_admin());
