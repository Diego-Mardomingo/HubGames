-- JUDI: la pista de la fase 3 pasa de «Pico de jugadores» a «Propietarios en Steam».
--
-- - `steamspy_ccu` no era un pico: eran los jugadores conectados al cargar el juego (casi todos en abril de 2026), así
--   que juegos con millones de propietarios salían con 0, 1 o 2 jugadores. Ahora la pista es `propietarios`, el rango
--   de SteamSpy tal cual (`steamspy_owners`, p. ej. «10,000,000 .. 20,000,000»); el cliente lo formatea.
-- - Deja de mandarse `ccu`. Un cliente antiguo abierto verá «N/D» en esa pista hasta recargar.
-- - Solo cambia esa línea de hubgames_judi_day_payload; create or replace conserva los permisos. No toca datos.
--
-- Revertir: volver a crear la función como en 20261025210000_hubgames_judi_servidor.sql
-- (`jsonb_build_object('ccu', v_steam.steamspy_ccu)` en la fase 3).

create or replace function public.hubgames_judi_day_payload(p_id bigint, p_phase integer, p_reveal boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day public.hubgames_lista_videojuegos_judi;
  v_steam public.hubgames_juegos_steam;
  v_captures integer;
  v_generos text;
  v_positive integer;
  v_year text;
  v_studio text;
  v_hints jsonb := '{}'::jsonb;
begin
  v_day := public.hubgames_judi_published(p_id);
  if v_day.id is null then
    raise exception 'JUDI no disponible' using errcode = 'P0002';
  end if;

  select * into v_steam from public.hubgames_juegos_steam where steam_appid = v_day.id_videojuego;
  select count(*) into v_captures from public.hubgames_capturas where id_videojuego = v_day.id_videojuego;

  if p_phase >= 2 then
    select string_agg(genero, ', ' order by ctid) into v_generos
    from public.hubgames_videojuego_genero where id_videojuego = v_day.id_videojuego;
    v_hints := v_hints || jsonb_build_object('generos', v_generos);
  end if;
  if p_phase >= 3 then
    v_hints := v_hints || jsonb_build_object('propietarios', nullif(btrim(v_steam.steamspy_owners), ''));
  end if;
  if p_phase >= 4 then
    v_positive := case
      when coalesce(v_steam.steamspy_userscore, 0) > 0 then round(v_steam.steamspy_userscore)
      when coalesce(v_steam.steamspy_positive, 0) + coalesce(v_steam.steamspy_negative, 0) = 0 then null
      else round(v_steam.steamspy_positive * 100.0 / (v_steam.steamspy_positive + v_steam.steamspy_negative))
    end;
    v_hints := v_hints || jsonb_build_object('positivas', v_positive);
  end if;
  if p_phase >= 5 then
    v_year := coalesce(
      extract(year from v_steam.release_date)::text,
      substring(coalesce(v_steam.release_date_text, '') || ' ' || coalesce(v_day.released, '') from '\m((?:19|20)\d{2})\M')
    );
    v_hints := v_hints || jsonb_build_object('anio', v_year);
  end if;
  if p_phase >= 6 then
    select nullif(string_agg(d, ', '), '') into v_studio
    from unnest(coalesce(v_steam.developers, '{}'::text[])) d where btrim(d) <> '';
    v_hints := v_hints || jsonb_build_object('estudio', v_studio);
  end if;

  return jsonb_build_object(
    'id', v_day.id,
    'fecha', v_day.fecha,
    'phase', p_phase,
    'capture_count', v_captures,
    'hints', v_hints,
    'nombre', case when p_reveal then v_day.nombre end,
    'header_image', case when p_reveal then v_steam.header_image end,
    'appid', case when p_reveal then v_day.id_videojuego end
  );
end;
$$;
