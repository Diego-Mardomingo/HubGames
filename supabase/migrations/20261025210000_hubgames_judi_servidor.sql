-- #39: JUDI se comprueba en el servidor. El navegador ya no recibe el nombre (ni el appid) del juego antes de terminar
-- y no puede escribir su progreso a mano.
--
-- - hubgames_judi_list(): los días publicados con tu progreso; nombre y portada solo de los que has terminado.
-- - hubgames_judi_get_day(id, fase): capturas y pistas desbloqueadas; el nombre solo al terminar.
-- - hubgames_judi_guess(id, intento): comprueba el intento (null = saltar), guarda el progreso y devuelve el día.
-- - hubgames_judi_guess_anon(id, intento, fase): lo mismo para invitados, cuyo progreso sigue en localStorage.
-- - hubgames_judi_capture_url(id, fase): URL de la captura para el proxy /api/judi/captura (solo service_role):
--   las URLs del CDN de Steam llevan el appid.
--
-- La puntuación no cambia: el progreso sigue siendo completado + fase1..fase6 en hubgames_judi_fases_usuario.

-- Mismo criterio que normalizeGameName() del cliente: sin tildes (NFD), minúsculas y solo [a-z0-9] separados por
-- espacios. No se usa unaccent: convierte ® en (R) y daría por mala la respuesta.
create or replace function public.hubgames_judi_normalize(p_value text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(lower(regexp_replace(normalize(coalesce(p_value, ''), NFD), '[\u0300-\u036f]', '', 'g')), '[^a-z0-9]+', ' ', 'g'));
$$;

-- Día publicado (hasta hoy en Madrid). Los de mañana existen desde las 11:00 pero no se pueden pedir.
create or replace function public.hubgames_judi_published(p_id bigint)
returns public.hubgames_lista_videojuegos_judi
language sql
stable
security definer
set search_path = ''
as $$
  select l.* from public.hubgames_lista_videojuegos_judi l
  where l.id = p_id and l.fecha_date <= (now() at time zone 'Europe/Madrid')::date;
$$;

-- Fase desbloqueada a partir del progreso: igual que el cliente (fase5 → 6, …, fase1 → 2, nada → 1).
create or replace function public.hubgames_judi_phase(p public.hubgames_judi_fases_usuario)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when p.completado or p.fase6 then 6
    when p.fase5 then 6 when p.fase4 then 5 when p.fase3 then 4 when p.fase2 then 3 when p.fase1 then 2
    else 1
  end;
$$;

-- Capturas, pistas hasta p_phase y, si p_reveal, nombre y portada.
-- Pistas: 2 géneros, 3 pico de jugadores, 4 % de reseñas positivas, 5 año, 6 estudio.
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
    v_hints := v_hints || jsonb_build_object('ccu', v_steam.steamspy_ccu);
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

create or replace function public.hubgames_judi_list()
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
  where l.fecha_date <= (now() at time zone 'Europe/Madrid')::date
  order by l.id desc;
$$;

-- Con sesión, la fase sale de tu progreso guardado (p_phase se ignora). Sin sesión, de p_phase (localStorage).
create or replace function public.hubgames_judi_get_day(p_id bigint, p_phase integer default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_progress public.hubgames_judi_fases_usuario;
  v_state text := 'playing';
  v_phase integer;
  v_guesses jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    return public.hubgames_judi_day_payload(p_id, least(greatest(coalesce(p_phase, 1), 1), 6), false)
      || jsonb_build_object('state', 'playing', 'failed', null, 'guesses', null);
  end if;

  select * into v_progress from public.hubgames_judi_fases_usuario where id_lista_judi = p_id and id_usuario = v_uid;
  v_phase := coalesce(public.hubgames_judi_phase(v_progress), 1);
  if v_progress.completado then v_state := 'won'; elsif v_progress.fase6 then v_state := 'lost'; end if;

  select coalesce(jsonb_agg(intento order by id), '[]'::jsonb) into v_guesses
  from public.hubgames_judi_intentos where id_lista_judi = p_id and id_usuario = v_uid;

  return public.hubgames_judi_day_payload(p_id, v_phase, v_state <> 'playing')
    || jsonb_build_object(
      'state', v_state,
      'failed', (coalesce(v_progress.fase1, false)::int + coalesce(v_progress.fase2, false)::int
        + coalesce(v_progress.fase3, false)::int + coalesce(v_progress.fase4, false)::int
        + coalesce(v_progress.fase5, false)::int + coalesce(v_progress.fase6, false)::int),
      'guesses', v_guesses
    );
end;
$$;

-- p_guess null o vacío = saltar intento. Fallar o saltar marca la fase actual; fallar en la 6 la pierde.
-- Acertar marca completado y borra los intentos fallidos (como hacía el cliente).
create or replace function public.hubgames_judi_guess(p_id bigint, p_guess text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_day public.hubgames_lista_videojuegos_judi;
  v_progress public.hubgames_judi_fases_usuario;
  v_phase integer;
  v_guess text := nullif(btrim(coalesce(p_guess, '')), '');
begin
  if v_uid is null then
    raise exception 'Inicia sesión para guardar tu partida' using errcode = '42501';
  end if;
  v_day := public.hubgames_judi_published(p_id);
  if v_day.id is null then
    raise exception 'JUDI no disponible' using errcode = 'P0002';
  end if;

  insert into public.hubgames_judi_fases_usuario (id_lista_judi, id_usuario)
  values (p_id, v_uid)
  on conflict (id_lista_judi, id_usuario) do nothing;

  select * into v_progress from public.hubgames_judi_fases_usuario
  where id_lista_judi = p_id and id_usuario = v_uid
  for update;

  if v_progress.completado or v_progress.fase6 then
    return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', 'finished');
  end if;
  v_phase := public.hubgames_judi_phase(v_progress);

  if v_guess is not null and public.hubgames_judi_normalize(v_guess) = public.hubgames_judi_normalize(v_day.nombre) then
    update public.hubgames_judi_fases_usuario
    set completado = true, fecha_completado = now()
    where id_lista_judi = p_id and id_usuario = v_uid;
    delete from public.hubgames_judi_intentos where id_lista_judi = p_id and id_usuario = v_uid;
    return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', 'correct');
  end if;

  if v_guess is not null then
    if exists (
      select 1 from public.hubgames_judi_intentos
      where id_lista_judi = p_id and id_usuario = v_uid
        and public.hubgames_judi_normalize(intento) = public.hubgames_judi_normalize(v_guess)
    ) then
      return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', 'duplicate');
    end if;
    insert into public.hubgames_judi_intentos (id_lista_judi, id_usuario, intento)
    values (p_id, v_uid, v_guess)
    on conflict do nothing;
  end if;

  update public.hubgames_judi_fases_usuario
  set fase1 = coalesce(fase1, false) or v_phase = 1,
      fase2 = coalesce(fase2, false) or v_phase = 2,
      fase3 = coalesce(fase3, false) or v_phase = 3,
      fase4 = coalesce(fase4, false) or v_phase = 4,
      fase5 = coalesce(fase5, false) or v_phase = 5,
      fase6 = coalesce(fase6, false) or v_phase = 6,
      fecha_completado = case when v_phase = 6 then now() else fecha_completado end
  where id_lista_judi = p_id and id_usuario = v_uid;

  return public.hubgames_judi_get_day(p_id) || jsonb_build_object('result', case when v_guess is null then 'skipped' else 'wrong' end);
end;
$$;

-- Invitados: no hay nada que guardar en el servidor. Devuelve el día en la fase siguiente y, al acertar o al fallar
-- la fase 6, el nombre. (Como cualquiera puede jugar sin sesión, quien pierda la partida ve la respuesta: igual que
-- con una segunda cuenta.)
create or replace function public.hubgames_judi_guess_anon(p_id bigint, p_guess text, p_phase integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_day public.hubgames_lista_videojuegos_judi;
  v_phase integer := least(greatest(coalesce(p_phase, 1), 1), 6);
  v_guess text := nullif(btrim(coalesce(p_guess, '')), '');
begin
  v_day := public.hubgames_judi_published(p_id);
  if v_day.id is null then
    raise exception 'JUDI no disponible' using errcode = 'P0002';
  end if;

  if v_guess is not null and public.hubgames_judi_normalize(v_guess) = public.hubgames_judi_normalize(v_day.nombre) then
    return public.hubgames_judi_day_payload(p_id, 6, true) || jsonb_build_object('state', 'won', 'result', 'correct');
  end if;
  if v_phase = 6 then
    return public.hubgames_judi_day_payload(p_id, 6, true) || jsonb_build_object('state', 'lost', 'result', 'wrong');
  end if;
  return public.hubgames_judi_day_payload(p_id, v_phase + 1, false)
    || jsonb_build_object('state', 'playing', 'result', case when v_guess is null then 'skipped' else 'wrong' end);
end;
$$;

-- Orden de las capturas: el de la tabla (ctid), como la consulta del cliente. Fase 1 → la 6.ª (o la última);
-- fases 2-6 → 1.ª a 5.ª.
create or replace function public.hubgames_judi_capture_url(p_id bigint, p_phase integer)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  with day as (
    select * from public.hubgames_judi_published(p_id) d where d.id is not null
  ),
  caps as (
    select array_agg(c.captura order by c.ctid) as urls
    from public.hubgames_capturas c join day on c.id_videojuego = day.id_videojuego
  )
  select urls[1 + case
           when p_phase <= 1 then least(5, cardinality(urls) - 1)
           else least(greatest(0, p_phase - 2), cardinality(urls) - 1)
         end]
  from caps
  where cardinality(urls) > 0;
$$;

-- Permisos: las funciones internas solo para el propietario.
revoke execute on function public.hubgames_judi_normalize(text) from public, anon, authenticated;
revoke execute on function public.hubgames_judi_published(bigint) from public, anon, authenticated;
revoke execute on function public.hubgames_judi_phase(public.hubgames_judi_fases_usuario) from public, anon, authenticated;
revoke execute on function public.hubgames_judi_day_payload(bigint, integer, boolean) from public, anon, authenticated;
revoke execute on function public.hubgames_judi_capture_url(bigint, integer) from public, anon, authenticated;
grant execute on function public.hubgames_judi_capture_url(bigint, integer) to service_role;

revoke execute on function public.hubgames_judi_list() from public;
grant execute on function public.hubgames_judi_list() to anon, authenticated, service_role;
revoke execute on function public.hubgames_judi_get_day(bigint, integer) from public;
grant execute on function public.hubgames_judi_get_day(bigint, integer) to anon, authenticated, service_role;
revoke execute on function public.hubgames_judi_guess(bigint, text) from public, anon;
grant execute on function public.hubgames_judi_guess(bigint, text) to authenticated, service_role;
revoke execute on function public.hubgames_judi_guess_anon(bigint, text, integer) from public, authenticated;
grant execute on function public.hubgames_judi_guess_anon(bigint, text, integer) to anon, service_role;

-- La lista y los datos de los juegos ya no se leen directamente (solo admins y service_role).
drop policy if exists "Public can view released JUDI games" on public.hubgames_lista_videojuegos_judi;
drop policy if exists "Anyone can view screenshots" on public.hubgames_capturas;
drop policy if exists "Anyone can view game genres" on public.hubgames_videojuego_genero;
drop policy if exists "Anyone can view game platforms" on public.hubgames_videojuego_plataforma;

-- El progreso solo lo escriben las funciones de arriba. Cada usuario sigue pudiendo leer el suyo.
drop policy if exists "Users can insert own progress" on public.hubgames_judi_fases_usuario;
drop policy if exists "Users can update own progress" on public.hubgames_judi_fases_usuario;
drop policy if exists "Users can insert own attempts" on public.hubgames_judi_intentos;
drop policy if exists "Users can delete own attempts" on public.hubgames_judi_intentos;
revoke insert, update, delete on public.hubgames_judi_fases_usuario from anon, authenticated;
revoke insert, update, delete on public.hubgames_judi_intentos from anon, authenticated;
