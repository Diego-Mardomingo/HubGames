-- #40: elección diaria de JUDI atómica y fecha como tipo date.

-- 1) fecha_date: versión date de `fecha` (texto DD-MM-YYYY). `fecha` se mantiene por compatibilidad
--    con el cliente y los scripts; un trigger mantiene las dos sincronizadas.
alter table public.hubgames_lista_videojuegos_judi add column if not exists fecha_date date;

create or replace function public.hubgames_judi_set_fecha_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.fecha_date := to_date(new.fecha, 'DD-MM-YYYY');
  return new;
end;
$$;

drop trigger if exists hubgames_judi_set_fecha_date on public.hubgames_lista_videojuegos_judi;
create trigger hubgames_judi_set_fecha_date
  before insert or update of fecha on public.hubgames_lista_videojuegos_judi
  for each row execute function public.hubgames_judi_set_fecha_date();

update public.hubgames_lista_videojuegos_judi
  set fecha_date = to_date(fecha, 'DD-MM-YYYY')
  where fecha_date is distinct from to_date(fecha, 'DD-MM-YYYY');

alter table public.hubgames_lista_videojuegos_judi
  add constraint hubgames_lista_videojuegos_judi_fecha_formato check (fecha ~ '^\d{2}-\d{2}-\d{4}$');
alter table public.hubgames_lista_videojuegos_judi
  add constraint hubgames_lista_videojuegos_judi_fecha_date_key unique (fecha_date);

drop policy if exists "Public can view released JUDI games" on public.hubgames_lista_videojuegos_judi;
create policy "Public can view released JUDI games" on public.hubgames_lista_videojuegos_judi
  for select to anon, authenticated
  using (fecha_date <= (now() at time zone 'Europe/Madrid')::date);

-- 2) Elección diaria en una sola transacción: juego, plataformas, géneros, capturas, pool y log.
--    Si algo falla, no queda nada a medias. Solo la ejecuta el servidor (service_role).
create or replace function public.hubgames_judi_pick_daily(p_fecha date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fecha_txt text := to_char(p_fecha, 'DD-MM-YYYY');
  v_existing record;
  v_cand record;
  v_steam record;
  v_list_id bigint;
  v_item text;
  v_screens integer;
begin
  -- Evita dos ejecuciones simultáneas (p. ej. cron + lanzamiento manual).
  perform pg_advisory_xact_lock(hashtext('hubgames_judi_pick_daily'));

  select id, nombre, steam_appid into v_existing
  from public.hubgames_lista_videojuegos_judi where fecha_date = p_fecha;
  if found then
    return jsonb_build_object('status', 'exists', 'id', v_existing.id,
      'nombre', v_existing.nombre, 'steam_appid', v_existing.steam_appid, 'fecha', v_fecha_txt);
  end if;

  for v_cand in
    select t.id, t.steam_appid, t.game_name
    from (
      select id, steam_appid, game_name
      from public.hubgames_judi_pool
      where is_eligible and not selected_for_daily and not discarded
      order by relevance_score desc
      limit 25
    ) t
    order by random()
  loop
    begin
      select * into v_steam from public.hubgames_juegos_steam where steam_appid = v_cand.steam_appid;
      if not found then
        raise exception 'Falta la entrada del catálogo Steam para %', v_cand.steam_appid;
      end if;

      insert into public.hubgames_lista_videojuegos_judi
        (id_videojuego, steam_appid, data_source, nombre, fecha, calificacion, desarrollador, released)
      values (
        v_cand.steam_appid, v_cand.steam_appid, 'steam_pool', v_steam.name, v_fecha_txt,
        coalesce(nullif(v_steam.metacritic_score, 0), 0),
        case when coalesce(v_steam.steamspy_userscore, 0) <> 0
             then round(v_steam.steamspy_userscore / 20.0, 1)::text else '0' end,
        coalesce(nullif(v_steam.release_date::text, ''), nullif(v_steam.release_date_text, ''), '')
      )
      returning id into v_list_id;

      -- Plataformas
      for v_item in
        select p from unnest(array[
          case when (v_steam.platforms->>'windows')::boolean then 'PC (Windows)' end,
          case when (v_steam.platforms->>'mac')::boolean then 'Mac' end,
          case when (v_steam.platforms->>'linux')::boolean then 'Linux' end
        ]) p where p is not null
      loop
        insert into public.hubgames_plataformas (plataforma) values (v_item) on conflict do nothing;
        insert into public.hubgames_videojuego_plataforma (id_videojuego, plataforma)
          values (v_cand.steam_appid, v_item) on conflict do nothing;
      end loop;

      -- Géneros
      for v_item in
        select distinct btrim(g->>'description')
        from jsonb_array_elements(coalesce(v_steam.genres, '[]'::jsonb)) g
        where btrim(coalesce(g->>'description', '')) <> ''
      loop
        insert into public.hubgames_generos (genero) values (v_item) on conflict do nothing;
        insert into public.hubgames_videojuego_genero (id_videojuego, genero)
          values (v_cand.steam_appid, v_item) on conflict do nothing;
      end loop;

      -- Capturas (hasta 7)
      insert into public.hubgames_capturas (id_videojuego, captura)
      select v_cand.steam_appid, s.path
      from (
        select distinct on (shot->>'path_full') shot->>'path_full' as path, ord
        from jsonb_array_elements(coalesce(v_steam.screenshots, '[]'::jsonb)) with ordinality as x(shot, ord)
        where coalesce(shot->>'path_full', '') <> ''
        order by shot->>'path_full', ord
      ) s
      order by s.ord
      limit 7
      on conflict do nothing;
      get diagnostics v_screens = row_count;

      update public.hubgames_judi_pool
        set selected_for_daily = true, selected_daily_date = p_fecha, selected_daily_list_id = v_list_id
        where id = v_cand.id;

      insert into public.hubgames_judi_generacion_logs (exito, nombre_juego, fecha_judi, fuente, id_juego_steam)
        values (true, format('Juego del día asignado: %s (Steam %s)', v_cand.game_name, v_cand.steam_appid),
                v_fecha_txt, 'steam_pool_daily_pick', v_cand.steam_appid);

      return jsonb_build_object('status', 'inserted', 'id', v_list_id, 'nombre', v_steam.name,
        'steam_appid', v_cand.steam_appid, 'fecha', v_fecha_txt, 'capturas', v_screens);
    exception when unique_violation then
      -- El juego ya salió en otra fecha: se descarta y se prueba el siguiente (lo anterior se deshace).
      update public.hubgames_judi_pool
        set discarded = true, discarded_reason = 'already_used_in_daily_history'
        where id = v_cand.id;
    end;
  end loop;

  raise exception 'No hay candidatos elegibles en hubgames_judi_pool para %', v_fecha_txt;
end;
$$;

revoke all on function public.hubgames_judi_pick_daily(date) from public, anon, authenticated;
grant execute on function public.hubgames_judi_pick_daily(date) to service_role;
