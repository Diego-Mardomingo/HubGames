-- Rediseño de JUDI (tus estadísticas e historial): hubgames_judi_list() devuelve también `attempts`, todos tus intentos
-- de cada día en orden (texto = fallo, null = salto), igual que ya hace hubgames_judi_get_day con la partida abierta.
-- Así cada fila del historial distingue saltos de fallos y «Tus intentos» se ve al desplegar el día sin otra consulta.
--
-- - Sin sesión (auth.uid() null) o sin intentos guardados, `attempts` es '[]': los invitados siguen con localStorage.
-- - Las partidas anteriores a 20261028180000_hubgames_judi_intentos_saltos no tienen sus saltos ni (si se acertaron)
--   sus fallos; el cliente lo detecta (menos intentos que fallos) y las enseña «sin orden».
-- - El resto de columnas, su orden, la visibilidad (nombre y portada solo si lo has terminado), el orden de las filas y
--   los permisos no cambian. Cambiar el tipo de retorno obliga a borrar y crear la función (create or replace no puede),
--   así que los grants se vuelven a dar tal cual. Ningún objeto de la base depende de esta función.
-- - No toca datos ni tablas.
--
-- Revertir: volver a crear hubgames_judi_list() como en 20261025210000_hubgames_judi_servidor.sql con
-- `drop function public.hubgames_judi_list();` delante, y repetir
-- `revoke execute on function public.hubgames_judi_list() from public;` y
-- `grant execute on function public.hubgames_judi_list() to anon, authenticated, service_role;`.
-- El cliente funciona con las dos versiones (sin `attempts`, los días con intentos salen «sin orden»).

drop function if exists public.hubgames_judi_list();

create function public.hubgames_judi_list()
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
  header_image text,
  attempts jsonb
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
         case when f.completado or f.fase6 then s.header_image end,
         coalesce((
           select jsonb_agg(i.intento order by i.id)
           from public.hubgames_judi_intentos i
           where i.id_lista_judi = l.id and i.id_usuario = auth.uid()
         ), '[]'::jsonb)
  from public.hubgames_lista_videojuegos_judi l
  left join public.hubgames_judi_fases_usuario f on f.id_lista_judi = l.id and f.id_usuario = auth.uid()
  left join public.hubgames_juegos_steam s on s.steam_appid = l.id_videojuego and (f.completado or f.fase6)
  where l.fecha_date <= (now() at time zone 'Europe/Madrid')::date
  order by l.id desc;
$$;

revoke execute on function public.hubgames_judi_list() from public;
grant execute on function public.hubgames_judi_list() to anon, authenticated, service_role;
