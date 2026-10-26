-- JUDI de hoy para la navegación: solo la fila del día de hoy (Europe/Madrid) con tu progreso, con los mismos campos y la
-- misma visibilidad que hubgames_judi_list() (nombre y portada solo si ya lo has terminado). Hasta ahora el cliente pedía
-- las 7 primeras filas de hubgames_judi_list() (orden id desc) y buscaba la de hoy, lo que fallaría si un día anterior
-- tuviera un id mayor. Sin fila = hoy no hay JUDI publicado.

create or replace function public.hubgames_judi_today()
returns table (
  id bigint,
  fecha text,
  completado boolean,
  fase1 boolean,
  fase2 boolean,
  fase3 boolean,
  fase4 boolean,
  fase5 boolean,
  fase6 boolean,
  nombre text,
  header_image text
)
language sql
stable
security definer
set search_path = ''
as $$
  select l.id, l.fecha,
         coalesce(f.completado, false), coalesce(f.fase1, false), coalesce(f.fase2, false), coalesce(f.fase3, false),
         coalesce(f.fase4, false), coalesce(f.fase5, false), coalesce(f.fase6, false),
         case when f.completado or f.fase6 then l.nombre end,
         case when f.completado or f.fase6 then s.header_image end
  from public.hubgames_lista_videojuegos_judi l
  left join public.hubgames_judi_fases_usuario f on f.id_lista_judi = l.id and f.id_usuario = auth.uid()
  left join public.hubgames_juegos_steam s on s.steam_appid = l.id_videojuego and (f.completado or f.fase6)
  where l.fecha_date = (now() at time zone 'Europe/Madrid')::date
  order by l.id desc
  limit 1;
$$;

revoke execute on function public.hubgames_judi_today() from public;
grant execute on function public.hubgames_judi_today() to anon, authenticated, service_role;
