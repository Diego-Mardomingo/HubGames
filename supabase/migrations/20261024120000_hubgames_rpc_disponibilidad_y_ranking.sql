-- #5 (parte A, aditiva): RPCs que necesita el cliente antes de cerrar la lectura pública.
-- Solo toca objetos hubgames_* (la base de datos es compartida con ECOS).

-- 3) Comprobar si un email o username está libre (único dato que ve un anónimo).
create or replace function public.hubgames_check_available(p_email text, p_username text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'email_taken', exists (
      select 1 from public.hubgames_usuarios where lower(email) = lower(btrim(p_email))
    ),
    'username_taken', exists (
      select 1 from public.hubgames_usuarios where lower(username) = lower(btrim(p_username))
    )
  );
$$;

revoke all on function public.hubgames_check_available(text, text) from public;
grant execute on function public.hubgames_check_available(text, text) to anon, authenticated;


-- 4) Ranking de JUDI: agregado sin exponer la tabla de progreso ni emails.
create or replace function public.hubgames_judi_ranking_rows()
returns table (
  id_usuario uuid, username text, completado boolean,
  fase1 boolean, fase2 boolean, fase3 boolean, fase4 boolean, fase5 boolean, fase6 boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id_usuario, u.username, f.completado,
         f.fase1, f.fase2, f.fase3, f.fase4, f.fase5, f.fase6
  from public.hubgames_judi_fases_usuario f
  left join public.hubgames_usuarios u on u.id = f.id_usuario
  where auth.uid() is not null and (f.completado or f.fase6)
  order by f.id_lista_judi, f.id_usuario;
$$;

revoke all on function public.hubgames_judi_ranking_rows() from public, anon;
grant execute on function public.hubgames_judi_ranking_rows() to authenticated;


alter function public.is_admin() set search_path = public;
