-- Rediseño del ranking: hubgames_judi_ranking_rows() devuelve también de qué JUDI es cada partida (`id_lista_judi`) y su
-- día (`dia`, `hubgames_lista_videojuegos_judi.fecha_date`). Con eso el cliente calcula la tendencia: el ranking sin las
-- partidas de los últimos 30 días de JUDI da el puesto de antes, y la diferencia con el de hoy es lo que sube o baja.
--
-- - Las dos columnas van al final; el resto de columnas, su orden, el filtro (solo con sesión y solo partidas
--   terminadas), el orden de las filas, `security definer` y `search_path` no cambian. `dia` sale de un left join, así
--   que ninguna fila se pierde aunque faltara su día (hoy no falta ninguno).
-- - Cambiar el tipo de retorno obliga a borrar y crear la función (create or replace no puede), así que los grants se
--   vuelven a dar tal cual (authenticated y service_role; nunca anon). Ningún objeto de la base depende de esta función.
-- - No toca datos ni tablas. No expone nada nuevo: el día de cada JUDI pasado ya es público en hubgames_judi_list().
--
-- Revertir: volver a crear la función como en 20261024000000_hubgames_baseline.sql con
-- `drop function public.hubgames_judi_ranking_rows();` delante, y repetir
-- `revoke all on function public.hubgames_judi_ranking_rows() from public, anon;` y
-- `grant execute on function public.hubgames_judi_ranking_rows() to authenticated, service_role;`.
-- El cliente funciona con las dos versiones (sin `dia`, el ranking se ve igual pero sin tendencia).

drop function if exists public.hubgames_judi_ranking_rows();

create function public.hubgames_judi_ranking_rows()
returns table (
  id_usuario uuid, username text, completado boolean,
  fase1 boolean, fase2 boolean, fase3 boolean, fase4 boolean, fase5 boolean, fase6 boolean,
  id_lista_judi bigint, dia date
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id_usuario, u.username, f.completado,
         f.fase1, f.fase2, f.fase3, f.fase4, f.fase5, f.fase6,
         f.id_lista_judi, l.fecha_date
  from public.hubgames_judi_fases_usuario f
  left join public.hubgames_usuarios u on u.id = f.id_usuario
  left join public.hubgames_lista_videojuegos_judi l on l.id = f.id_lista_judi
  where auth.uid() is not null and (f.completado or f.fase6)
  order by f.id_lista_judi, f.id_usuario;
$$;

revoke all on function public.hubgames_judi_ranking_rows() from public, anon;
grant execute on function public.hubgames_judi_ranking_rows() to authenticated, service_role;
